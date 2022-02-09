import {
  Console, colors, bold,
  Identity, waitUntilNextBlock,
  Contract, Instance, Message,
  readFile,
  backOff,
  toBase64
} from '@fadroma/ops'
import {
  EnigmaUtils, encodeSecp256k1Pubkey,
  pubkeyToAddress, makeSignBytes, BroadcastMode,
  SigningCosmWasmClient,
} from 'secretjs'

import { ScrtGas, APIConstructor } from './ScrtCore'
import { ScrtAgent } from './ScrtAgent'
import { SigningScrtBundle } from './SigningScrtBundle'
import type { Scrt } from './ScrtChain'

const console = Console('@fadroma/scrt/ScrtAgentJS')

export abstract class ScrtAgentJS extends ScrtAgent {

  fees = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'
  Bundle = SigningScrtBundle

  constructor (options: Identity & { API?: APIConstructor } = {}) {
    super(options)

    this.name = this.trace.name = options?.name || ''

    this.chain    = options?.chain as Scrt // TODO chain id to chain
    this.fees     = options?.fees || ScrtGas.defaultFees

    this.keyPair  = options?.keyPair
    this.mnemonic = options?.mnemonic
    this.pen      = options?.pen
    if (this.pen) {
      this.pubkey   = encodeSecp256k1Pubkey(options?.pen.pubkey)
      this.address  = pubkeyToAddress(this.pubkey, 'secret')
      this.sign     = this.pen.sign.bind(this.pen)
      this.seed     = EnigmaUtils.GenerateNewSeed()
    }
  }

  readonly name:     string
  readonly chain:    Scrt
  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      any
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  readonly address:  string

  abstract readonly API: typeof SigningCosmWasmClient
  get api () {
    return new this.API(
      this.chain?.url,
      this.address,
      this.sign,
      this.seed,
      this.fees,
      BroadcastMode.Sync
    )
  }

  get nextBlock () { return waitUntilNextBlock(this) }

  get block     () { return this.api.getBlock() }

  get account   () { return this.api.getAccount(this.address) }

  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.api.sendTokens(recipient, [{denom, amount}], memo)
  }

  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber: any
    let sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async upload (pathToBinary: string) {
    if (!(typeof pathToBinary === 'string')) {
      throw new Error(
        `@fadroma/scrt: Need path to binary (string), received: ${pathToBinary}`
      )
    }
    const data = await readFile(pathToBinary)
    return await this.api.upload(data, {})
  }

  async getCodeHash (idOrAddr: number|string): Promise<string> {
    if (typeof idOrAddr === 'number') {
      return await this.api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await this.api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }

  async checkCodeHash (address: string, codeHash?: string) {
    // Soft code hash checking for now
    const realCodeHash = await this.getCodeHash(address)
    if (codeHash !== realCodeHash) {
      console.warn(bold('Code hash mismatch for'), address, `(${name})`)
      console.warn(bold('  Config:'), codeHash)
      console.warn(bold('  Chain: '), realCodeHash)
    } else {
      console.info(bold(`Code hash of ${address}:`), realCodeHash)
    }
  }

  async instantiate (template, label, msg, funds = []) {
    if (!template.codeHash) {
      throw new Error('@fadroma/scrt: Template must contain codeHash')
    }
    return super.instantiate(template, label, msg, funds)
  }

  async doInstantiate (template, label, msg, funds = []) {
    const { codeId, codeHash } = template
    const { logs, transactionHash } = await backOff(() => {
      return this.api.instantiate(Number(codeId), msg, label)
    }, {
      retry (error: Error, attempt: number) {
        if (error.message.includes('500')) {
          console.warn(`Error 500, retry #${attempt}...`)
          console.error(error)
          return true
        } else {
          return false
        }
      }
    })
    return {
      chainId:  this.chain.id,
      codeId:   Number(codeId),
      codeHash: codeHash,
      address:  logs[0].events[0].attributes[4].value,
      transactionHash,
    }
  }

  /** Instantiate multiple contracts from a bundled transaction. */
  async instantiateMany (
    contracts: [Contract<any>, any?, string?, string?][],
    prefix?: string
  ): Promise<Record<string, Instance>> {
    // results by contract name
    const receipts = await super.instantiateMany(contracts, prefix)
    console.log(receipts)
    // populate code hash in receipt and `contract.instance` properties
    for (const i in contracts) {
      const contract = contracts[i][0]
      const receipt = receipts[contract.name]
      if (receipt) {
        receipt.codeHash = contract.template?.codeHash||contract.codeHash
      }
    }
    return receipts
  }

  async getCodeId (address: string): Promise<number> {
    const { codeId } = await this.api.getContract(address)
    return codeId
  }
  async getLabel (address: string): Promise<string> {
    const { label } = await this.api.getContract(address)
    return label
  }
  async doQuery (
    { label, address, codeHash }: Contract<any>, msg: Message
  ) {
    return this.api.queryContractSmart(address, msg as any, undefined, codeHash)
  }
  async doExecute (
    { label, address, codeHash }: Contract<any>, msg: Message,
    memo: any, amount: any, fee: any
  ) {
    return this.api.execute(address, msg as any, memo, amount, fee, codeHash)
  }

  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  async signTx (msgs, gas, memo) {
    const { accountNumber, sequence } = await this.api.getNonce()
    return await this.api.signAdapter(
      msgs,
      gas,
      this.chain.id,
      memo,
      accountNumber,
      sequence
    )
  }
}

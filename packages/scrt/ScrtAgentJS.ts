import {
  Console, colors, bold,
  Identity, Template, Label, InitMsg, Artifact, Instance, Message,
  readFile, backOff, toBase64
} from '@fadroma/ops'

import {
  EnigmaUtils, encodeSecp256k1Pubkey,
  pubkeyToAddress, makeSignBytes, BroadcastMode,
  SigningCosmWasmClient,
} from 'secretjs'

import { ScrtGas, APIConstructor } from './ScrtCore'
import { ScrtAgent } from './ScrtAgent'
import { BroadcastingScrtBundle } from './ScrtBundle'
import type { Scrt } from './ScrtChain'

const console = Console('@fadroma/scrt/ScrtAgentJS')

export abstract class ScrtAgentJS extends ScrtAgent {

  fees = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'
  Bundle = BroadcastingScrtBundle

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

  async upload (artifact: Artifact): Promise<Template> {
    const data = await readFile(artifact.location)
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") {
      codeId = uploadResult.logs[0].events[0].attributes[3].value
    }
    const codeHash = uploadResult.originalChecksum
    if (codeHash !== artifact.codeHash) {
      console.warn(
        bold(`Code hash mismatch`),
        `when uploading`, artifact.location,
        `(expected: ${artifact.codeHash}, got: ${codeHash})`
      )
    }
    return { chainId: this.chain.id, codeId, codeHash }
  }

  async getCodeHash (idOrAddr: number|string): Promise<string> {
    const { api } = this
    return this.rateLimited(async function getCodeHashInner () {
      if (typeof idOrAddr === 'number') {
        return await api.getCodeHashByCodeId(idOrAddr)
      } else if (typeof idOrAddr === 'string') {
        return await api.getCodeHashByContractAddr(idOrAddr)
      } else {
        throw new TypeError('getCodeHash id or addr')
      }
    })
  }

  async checkCodeHash (address: string, codeHash?: string) {
    // Soft code hash checking for now
    const realCodeHash = await this.getCodeHash(address)
    if (codeHash !== realCodeHash) {
      console.warn(bold('Code hash mismatch for address:'), address)
      console.warn(bold('  Expected code hash:'), codeHash)
      console.warn(bold('  Code hash on chain:'), realCodeHash)
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
    const { api } = this
    const { logs, transactionHash } = await this.rateLimited(function doInstantiateInner () {
      return api.instantiate(Number(codeId), msg, label)
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
    configs: [Template, Label, InitMsg][],
    prefix?: string
  ): Promise<Record<string, Instance>> {
    // supermethod returns instances/receipts keyed by name
    const receipts = await super.instantiateMany(configs, prefix)
    // add code hashes to them:
    for (const i in configs) {
      const [template, label, initMsg] = configs[i]
      const receipt = receipts[label]
      if (receipt) {
        receipt.codeHash = template.codeHash
      }
    }
    return receipts
  }

  async getCodeId (address: string): Promise<number> {
    //console.trace('getCodeId', address)
    const { api } = this
    return this.rateLimited(async function getCodeIdInner () {
      const { codeId } = await api.getContract(address)
      return codeId
    })
  }

  async getLabel (address: string): Promise<string> {
    const { api } = this
    return this.rateLimited(async function getLabelInner () {
      const { label } = await api.getContract(address)
      return label
    })
  }

  async doQuery (
    { label, address, codeHash }: Instance, msg: Message
  ) {
    const { api } = this
    return this.rateLimited(function doQueryInner () {
      return api.queryContractSmart(address, msg as any, undefined, codeHash)
    })
  }

  async doExecute (
    { label, address, codeHash }: Instance, msg: Message,
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

  private initialWait = 1000

  private async rateLimited <T> (fn: ()=>Promise<T>): Promise<T> {
    //console.log('rateLimited', fn)
    let initialWait = 0
    if (this.chain.isMainnet && !!process.env.FADROMA_RATE_LIMIT) {
      const initialWait = this.initialWait*Math.random()
      console.warn(
        "Avoid running into rate limiting by waiting",
        Math.floor(initialWait), 'ms'
      )
      await new Promise(resolve=>setTimeout(resolve, initialWait))
      console.warn("Wait is over")
    }
    return backOff(fn, {
      jitter:        'full',
      startingDelay: 100 + initialWait,
      timeMultiple:  3,
      retry (error: Error, attempt: number) {
        if (error.message.includes('500')) {
          console.warn(`Error 500, retry #${attempt}...`)
          console.error(error.message)
          return true
        } else if (error.message.includes('429')) {
          console.warn(`Error 429, retry #${attempt}...`)
          console.error(error.message)
          return true
        } else {
          return false
        }
      }
    })
  }

}

export async function waitUntilNextBlock (
  agent:    ScrtAgent,
  interval: number = 1000
) {
  console.info(
    bold('Waiting until next block with'), agent.address
  )
  // starting height
  const {header:{height}} = await agent.block
  //console.info(bold('Block'), height)
  // every `interval` msec check if the height has increased
  return new Promise<void>(async resolve=>{
    while (true) {
      // wait for `interval` msec
      await new Promise(ok=>setTimeout(ok, interval))
      // get the current height
      const now = await agent.block
      //console.info(bold('Block'), now.header.height)
      // check if it went up
      if (now.header.height > height) {
        resolve()
        break
      }
    }
  })
}

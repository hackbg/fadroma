export * from '@fadroma/ops'

import { Console, colors, bold } from '@fadroma/ops'
const console = Console('@fadroma/scrt')

import { SigningCosmWasmClient } from 'secretjs'
export type APIConstructor = new(...args:any) => SigningCosmWasmClient

import { dirname, fileURLToPath } from '@fadroma/ops'
export const __dirname = dirname(fileURLToPath(import.meta.url))

import { resolve } from '@hackbg/tools'
export const buildScript = resolve(__dirname, 'ScrtBuild.sh')

import { DockerBuilder } from '@fadroma/ops'
export class ScrtDockerBuilder extends DockerBuilder {
  buildImage      = null
  buildDockerfile = null
  buildScript     = buildScript
}

import { Client, Contract } from '@fadroma/ops'
export abstract class ScrtContract<C extends Client> extends Contract<C> {
  Builder = ScrtDockerBuilder
}

import {
  CachingUploader,
  BaseChain, Source, codeHashForPath,
  basename, existsSync, relative, cwd,
  readFileSync, writeFileSync
} from '@fadroma/ops'
export abstract class Scrt extends BaseChain {
  faucet = `https://faucet.secrettestnet.io/`
}

import { Fees, BaseGas } from '@fadroma/ops'
export class ScrtGas extends BaseGas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  //denom = ScrtGas.denom
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}

import { ChainNodeOptions, ChainNode } from '@fadroma/ops'
export type ScrtNodeConstructor = new (options?: ChainNodeOptions) => ChainNode

import { DockerChainNode, Path, Directory, TextFile, JSONFile, JSONDirectory } from '@fadroma/ops'
export abstract class DockerScrtNode extends DockerChainNode {
  abstract readonly chainId:    string
  abstract readonly image:      string
  abstract readonly initScript: TextFile
  protected setDirectories (stateRoot?: Path) {
    if (!this.chainId) {
      throw new Error('@fadroma/scrt: refusing to create directories for localnet with empty chain id')
    }
    stateRoot = stateRoot || resolve(process.cwd(), 'receipts', this.chainId)
    Object.assign(this, { stateRoot: new Directory(stateRoot) })
    Object.assign(this, {
      identities: this.stateRoot.subdir('identities', JSONDirectory),
      nodeState:  new JSONFile(stateRoot, 'node.json'),
    })
  }
}

import {
  Identity, Agent, Agent, AgentConstructor, waitUntilNextBlock,
  Contract, Message, getMethod,
  readFile, backOff
} from '@fadroma/ops'
import { Bip39 } from '@cosmjs/crypto'
import {
  EnigmaUtils, Secp256k1Pen, encodeSecp256k1Pubkey,
  pubkeyToAddress, makeSignBytes, BroadcastMode
} from 'secretjs'

export abstract class ScrtAgent extends Agent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async createSub (AgentClass: AgentConstructor, options: Identity): Promise<Agent> {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    let info = ''
    if (mnemonic) {
      info = bold(`Creating SecretJS agent from mnemonic:`) + ` ${name} `
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`ScrtAgentJS: Keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      info = `ScrtAgentJS: generating mnemonic from keypair for agent ${bold(name)}`
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      info = `ScrtAgentJS: creating new SecretJS agent: ${bold(name)}`
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    const pen  = await Secp256k1Pen.fromMnemonic(mnemonic)
    const agent = new AgentClass({name, mnemonic, keyPair, pen, ...args})
    return agent
  }

  /** Get the code hash for a code id or address */
  abstract getCodeHash (idOrAddr: number|string): Promise<string>

}

export abstract class ScrtAgentJS extends ScrtAgent {

  fees = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'
  Bundle = ScrtBundle

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

    this.API = new (options.API)(
      this.chain?.url,
      this.address,
      this.sign,
      this.seed,
      this.fees,
      BroadcastMode.Sync
    )
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
  readonly API:      SigningCosmWasmClient

  get nextBlock () { return waitUntilNextBlock(this) }

  get block     () { return this.API.getBlock() }

  get account   () { return this.API.getAccount(this.address) }

  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }

  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber: any
    let sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async upload (pathToBinary: string) {
    if (!(typeof pathToBinary === 'string')) {
      throw new Error(
        `@fadroma/scrt: Need path to binary (string), received: ${pathToBinary}`
      )
    }
    const data = await readFile(pathToBinary)
    return await this.API.upload(data, {})
  }

  async getCodeHash (idOrAddr: number|string): Promise<string> {
    if (typeof idOrAddr === 'number') {
      return await this.API.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await this.API.getCodeHashByContractAddr(idOrAddr)
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
      return this.API.instantiate(Number(codeId), msg, label)
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
    const receipts = {}
    // results by tx order
    const results = await this.bundle().wrap(bundle => {
      return bundle.instantiateMany(contracts, prefix)
    })
    // collect receipt and `contract.instance` properties
    for (const i in contracts) {
      const contract = contracts[i][0]
      const receipt  = results[i]
      if (receipt) {
        receipt.codeHash = contract.template?.codeHash||contract.codeHash
        contract.instance = receipt
        receipts[contract.name] = receipt
      }
    }
    return receipts
  }
  async getCodeId (address: string): Promise<number> {
    const { codeId } = await this.API.getContract(address)
    return codeId
  }
  async getLabel (address: string): Promise<string> {
    const { label } = await this.API.getContract(address)
    return label
  }
  async doQuery (
    { label, address, codeHash }: Contract<any>, msg: Message
  ) {
    return this.API.queryContractSmart(address, msg as any, undefined, codeHash)
  }
  async doExecute (
    { label, address, codeHash }: Contract<any>, msg: Message,
    memo: any, amount: any, fee: any
  ) {
    return this.API.execute(address, msg as any, memo, amount, fee, codeHash)
  }
}

import type { Chain } from '@fadroma/ops'
/** This agent just collects unsigned txs and dumps them in the end
  * to be performed by manual multisig (via Motika). */
export class ScrtAgentTX extends ScrtAgent {
  constructor (private readonly agent: ScrtAgentJS) {
    super()
  }

  get address () { return this.agent.address }
  get chain () { return this.agent.chain }

  account_number: number = 0
  sequence:       number = 0
  transactions:   UnsignedTX[] = []
  private pushTX (...msgs: any[]) {
    const tx = {
      chain_id:       this.chain.id,
      account_number: String(this.account_number),
      sequence:       String(this.sequence),
      fee:            "1000000uscrt",
      memo:           "",
      msgs:           JSON.stringify(msgs)
    }
    this.transactions.push(tx)
    return tx
  }
  async send () { throw new Error('not implemented') }
  async sendMany () { throw new Error('not implemented') }
  async upload () { throw new Error('not implemented') }
  async instantiate (
    { codeId, codeHash },
    label,
    message,
    init_funds = []
  ): Promise<UnsignedTX> {
    const init_msg = toBase64(await this.encrypt(codeHash, message))
    const type = "wasm/MsgInstantiateContract"
    return this.pushTX({
      type,
      value: {
        sender:  this.address,
        code_id: String(codeId),
        label,
        init_msg,
        init_funds,
      }
    })
  }
  async execute (
    { address, codeHash },
    message: Message,
    sent_funds = []
  ): Promise<UnsignedTX> {
    const msg  = toBase64(await this.encrypt(codeHash, message))
    const type = "wasm/MsgExecuteContract"
    return this.pushTX({
      type,
      value: {
        sender:   this.address,
        contract: address,
        msg,
        sent_funds,
      }
    })
  }
  query (instance: { address, codeHash }, message: Message): Promise<any> {
    console.trace(`ScrtAgentTX.query: not implemented: ${JSON.stringify(message)}`)
    return null
  }

  private async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.agent.API.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }
}

import { Bundle, BundleResult, Artifact, Template, Instance, toBase64, fromBase64, fromUtf8 } from '@fadroma/ops'
import { PostTxResult } from 'secretjs'
import pako from 'pako'
export class ScrtBundle extends Bundle {

  constructor (readonly agent: ScrtAgentJS) { super(agent as Agent) }

  upload ({ location }: Artifact) {
    this.add(readFile(location).then(wasm=>({
      type: 'wasm/MsgStoreCode',
      value: {
        sender:         this.address,
        wasm_byte_code: toBase64(pako.gzip(wasm, { level: 9 }))
      }
    })))
    return this
  }

  init ({ codeId, codeHash }: Template, label, msg, init_funds = []) {
    const sender  = this.address
    const code_id = String(codeId)
    this.add(this.encrypt(codeHash, msg).then(init_msg=>({
      type: 'wasm/MsgInstantiateContract',
      value: { sender, code_id, init_msg, label, init_funds }
    })))
    return this
  }

  async instantiate (template: Template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  async instantiateMany (
    contracts: [Contract<any>, string?, any?][],
    prefix?:   string
  ): Promise<Instance[]> {
    for (const [
      contract,
      msg    = contract.initMsg,
      name   = contract.name,
      suffix = contract.suffix
    ] of contracts) {
      // if custom contract properties are passed to instantiate,
      // set them on the contract class. FIXME this is a mutation,
      // the contract class should not exist, this function should
      // take `Template` instead of `Contract`
      contract.initMsg = msg
      contract.name    = name
      contract.suffix  = suffix

      // generate the label here since `get label () {}` is no more
      let label = `${name}${suffix||''}`
      if (prefix) label = `${prefix}/${label}`
      console.info(bold('Instantiate:'), label)

      // add the init tx to the bundle. when passing a single contract
      // to instantiate, this should behave equivalently to non-bundled init
      await this.instantiate(
        contract.template || {
          chainId:  contract.chainId,
          codeId:   contract.codeId,
          codeHash: contract.codeHash
        },
        label,
        msg
      )
    }
    return contracts.map(contract=>contract[0].instance)
  }

  execute ({ address, codeHash }: Instance, msg, sent_funds = []) {
    const sender   = this.address
    const contract = address
    this.add(this.encrypt(codeHash, msg).then(msg=>({
      type: 'wasm/MsgExecuteContract',
      value: { sender, contract, msg, sent_funds }
    })))
    return this
  }

  private async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.agent.API.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  async submit (memo = ""): Promise<BundleResult[]> {
    const N = this.agent.trace.call(
      `${bold(colors.yellow('MULTI'.padStart(5)))} ${this.msgs.length} messages`,
    )
    const { accountNumber, sequence } = await this.agent.API.getNonce()
    const msgs = await Promise.all(this.msgs)
    for (const msg of msgs) {
      this.agent.trace.subCall(N, `${bold(colors.yellow(msg.type))}`)
    }
    const signedTx = await this.agent.API.signAdapter(
      msgs,
      new ScrtGas(this.msgs.length*5000000),
      this.chainId,
      memo,
      accountNumber,
      sequence
    )
    try {
      const txResult = await this.agent.API.postTx(signedTx)
      this.agent.trace.response(N, txResult.transactionHash)
      const results = []
      for (const i in msgs) {
        results[i] = {
          sender:  this.address,
          tx:      txResult.transactionHash,
          type:    msgs[i].type,
          chainId: this.chainId
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          const attrs = mergeAttrs(txResult.logs[i].events[0].attributes as any[])
          results[i].label   = msgs[i].value.label,
          results[i].address = attrs.contract_address
          results[i].codeId  = attrs.code_id
        }
        if (msgs[i].type === 'wasm/MsgExecuteContract') {
          results[i].address = msgs[i].contract
        }
      }
      return results
    } catch (err) {
      await this.handleError(err)
    }
  }

  private async handleError (err) {
    try {
      console.error(err.message)
      console.error('Trying to decrypt...')
      const errorMessageRgx = /failed to execute message; message index: (\d+): encrypted: (.+?): (?:instantiate|execute|query) contract failed/g;
      const rgxMatches = errorMessageRgx.exec(err.message);
      if (rgxMatches == null || rgxMatches.length != 3) {
          throw err;
      }
      const errorCipherB64 = rgxMatches[1];
      const errorCipherBz  = fromBase64(errorCipherB64);
      const msgIndex       = Number(rgxMatches[2]);
      const nonce          = fromBase64(this.msgs[msgIndex].value.msg).slice(0, 32);
      const errorPlainBz   = await this.agent.API.restClient.enigmautils.decrypt(errorCipherBz, nonce);
      err.message = err.message.replace(errorCipherB64, fromUtf8(errorPlainBz));
    } catch (decryptionError) {
      console.error('Failed to decrypt :(')
      throw new Error(`Failed to decrypt the following error message: ${err.message}. Decryption error of the error message: ${decryptionError.message}`);
    }
    throw err
  }
}

export enum TxType {
  Spend        = "spend",
  ContractInit = "contractInit",
  ContractCall = "contractCall",
}

export type UnsignedTX = {
  chain_id:       string
  account_number: string
  sequence:       string
  fee:            string
  msgs:           string
  memo:           string
}

export function mergeAttrs (
  attrs: {key:string,value:string}[]
): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

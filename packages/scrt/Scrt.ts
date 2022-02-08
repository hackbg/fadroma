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

import { Client, BaseContract } from '@fadroma/ops'
export abstract class ScrtContract<C extends Client> extends BaseContract<C> {
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

  async buildAll (contracts: Contract<any>[]): Promise<Artifact[]> {
    return Promise.all(contracts.map(contract=>contract.build()))
  }

  async buildAndUpload (agent: Agent, contracts: Contract<any>[]): Promise<void> {
    const artifacts = await this.buildAll(contracts)
    const uploader = new CachingUploader(agent, this.uploads)
    await uploader.uploadAll(agent, contracts)
  }
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
  Identity, Agent, BaseAgent, AgentConstructor, waitUntilNextBlock,
  Contract, Message, getMethod,
  readFile, backOff
} from '@hackbg/fadroma'
import { Bip39 } from '@cosmjs/crypto'
import {
  EnigmaUtils, Secp256k1Pen, encodeSecp256k1Pubkey,
  pubkeyToAddress, makeSignBytes, BroadcastMode
} from 'secretjs'
export abstract class ScrtAgentJS extends BaseAgent {

  /** Create a new agent from a signing pen. */
  constructor (options: Identity & { API?: APIConstructor } = {}) {
    super(options)
    this.name     = options?.name || ''
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

  readonly name:     string

  readonly chain:    Scrt
  fees = ScrtGas.defaultFees

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
  get balance   () { return this.getBalance('uscrt') }
  async getBalance (denomination: string) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount
  }
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
  async instantiate (template, label, initMsg) {
    if (!template) {
      throw new Error('@fadroma/scrt: need a Template to instantiate')
    }
    const { chainId, codeId, codeHash } = template
    if (!template.chainId || !template.codeId || !template.codeId) {
      throw new Error('@fadroma/scrt: Template must contain chainId, codeId and codeHash')
    }
    if (template.chainId !== this.chain.id) {
      throw new Error(`@fadroma/scrt: Template is from chain ${template.chainId}, we're on ${this.chain.id}`)
    }
    const N = this.traceCall(`${bold('INIT')}  ${codeId} ${label}`)
    const { logs, transactionHash } = await backOff(() => {
      return this.API.instantiate(Number(codeId), initMsg, label)
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
    // hmm
    this.traceResponse(N, transactionHash)
    return {
      chainId: this.chain.id,
      codeId:  Number(codeId),
      codeHash,
      address: logs[0].events[0].attributes[4].value,
      transactionHash,
    }
  }
  async getCodeId (address: string): Promise<number> {
    const { codeId } = await this.API.getContract(address)
    return codeId
  }
  async getLabel (address: string): Promise<string> {
    const { label } = await this.API.getContract(address)
    return label
  }
  async query (contract: Contract, msg: Message) {
    const { label, address, codeHash } = contract
    const from   = this.address
    const method = getMethod(msg)
    const N = this.traceCall(
      `${bold(colors.blue('QUERY'.padStart(5)))} ${bold(method.padEnd(20))} on ${contract.address} ${bold(contract.name||'???')}`,
      //{ msg }
    )
    const response = await this.API.queryContractSmart(address, msg as any, undefined, codeHash)
    this.traceResponse(N, /*{ response }*/)
    return response
  }
  async execute (contract: Contract, msg: Message, memo: any, amount: any, fee: any) {
    const { label, address, codeHash } = contract
    const from   = this.address
    const method = getMethod(msg)
    const N = this.traceCall(
      `${bold(colors.yellow('TX'.padStart(5)))} ${bold(method.padEnd(20))} on ${contract.address} ${bold(contract.name||'???')}`,
      //{ msg, memo, amount, fee }
    )
    const result = await this.API.execute(address, msg as any, memo, amount, fee, codeHash)
    this.traceResponse(N, result.transactionHash)
    return result
  }
  bundle () {
    return new ScrtBundle(this)
  }
}

import { BaseBundle, Artifact, Template, Instance, toBase64, fromBase64, fromUtf8 } from '@fadroma/ops'
import { PostTxResult } from 'secretjs'
import pako from 'pako'
export class ScrtBundle extends BaseBundle<PostTxResult> {

  constructor (readonly agent: ScrtAgentJS) { super(agent) }

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

  async run (memo = ""): Promise<{
    tx:       string,
    codeId?:  string,
    address?: string,
  }[]> {
    const N = this.agent.traceCall(
      `${bold(colors.yellow('MULTI'.padStart(5)))} ${this.msgs.length} messages`,
    )
    const { accountNumber, sequence } = await this.agent.API.getNonce()
    const msgs = await Promise.all(this.msgs)
    for (const msg of msgs) {
      this.agent.traceSubCall(N, `${bold(colors.yellow(msg.type))}`)
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
      this.agent.traceResponse(N, txResult.transactionHash)
      const results = []
      for (const i in msgs) {
        results[i] = {
          sender: this.address,
          tx:     txResult.transactionHash,
          type:   msgs[i].type,
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

import type { MsgInstantiateContract, MsgExecuteContract } from 'secretjs/src/types'
/** This agent just collects unsigned txs
  * and dumps them in the end
  * to do via multisig. */
export abstract class ScrtAgentTX extends BaseAgent {
  constructor (id: Identity) { super(id) }

  account_number: number = 0
  sequence:       number = 0
  transactions:   UnsignedTX[] = []
  private pushTX (...msgs: (MsgInstantiateContract|MsgExecuteContract)[]) {
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
  async instantiate (
    { codeId, codeHash },
    label,
    message,
    init_funds = []
  ): Promise<UnsignedTX> {
    const init_msg = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    const type = "wasm/MsgInstantiateContract"
    return this.pushTX({ type, value: {
      sender:  this.address,
      code_id: String(codeId),
      label,
      init_msg,
      init_funds,
    } })
  }
  query (contract: Contract, message: Message): Promise<any> {
    throw new Error('ScrtAgentTX.query: not implemented')
  }
  async execute (
    { address, codeHash },
    message: Message,
    sent_funds = []
  ): Promise<UnsignedTX> {
    const msg  = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    const type = "wasm/MsgExecuteContract"
    return this.pushTX({ type, value: {
      sender:   this.address,
      contract: address,
      msg,
      sent_funds,
    } })
  }
}

export function mergeAttrs (
  attrs: {key:string,value:string}[]
): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

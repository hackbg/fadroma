/*
  Fadroma Platform Package for Secret Network
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import type {
  Address,
  AgentClass,
  AgentOpts,
  BundleClass,
  ChainClass,
  ChainId,
  CodeHash,
  CodeId,
  DeployArgs,
  ExecOpts,
  ICoin,
  IFee,
  Label,
  Message,
  TxHash,
  Uint128,
} from '@fadroma/client'
import { Agent, Bundle, Chain, Client, Contract, Fee } from '@fadroma/client'
import * as SecretJS from 'secretjs'

import { base64, randomBytes } from '@hackbg/formati'
import { CustomConsole, CustomError } from '@hackbg/konzola'
import structuredClone from '@ungap/structured-clone'

import { ScrtConfig, ScrtGrpcConfig } from './scrt-config'
import { ScrtError, ScrtConsole } from './scrt-events'

///////////////////////////////////////////////////////////////////////////////////////////////////
/// # BASE DEFINITIONS FOR ALL SECRET NETWORK API IMPLEMENTATIONS /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents the Secret Network in general. */
export abstract class Scrt extends Chain {
  static Config                   = ScrtConfig
  static defaultMainnetChainId    = this.Config.defaultMainnetChainId
  static defaultTestnetChainId    = this.Config.defaultTestnetChainId
  static Agent:           AgentClass<ScrtAgent> // set below
  static isSecretNetwork: boolean = true
  static defaultDenom:    string  = 'uscrt'
  static gas (amount: Uint128|number) { return new Fee(amount, this.defaultDenom) }
  static defaultFees  = {
    upload: this.gas(10000000),
    init:   this.gas(10000000),
    exec:   this.gas(10000000),
    send:   this.gas(10000000),
  }

  Agent: AgentClass<ScrtAgent> = Scrt.Agent
  isSecretNetwork: boolean = Scrt.isSecretNetwork
  defaultDenom:    string  = Scrt.defaultDenom
}

/** Agent configuration options that are common betweeen
  * gRPC and Amino implementations of Secret Network. */
export interface ScrtAgentOpts extends AgentOpts {
  keyPair?: unknown
}

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents a connection to the Secret Network authenticated as a specific address. */
export abstract class ScrtAgent extends Agent {
  static Bundle: BundleClass<ScrtBundle>
  fees = Scrt.defaultFees
  Bundle: BundleClass<ScrtBundle> =
    (this.constructor as AgentClass<Agent>).Bundle as BundleClass<ScrtBundle>
  abstract getNonce (): Promise<{ accountNumber: number, sequence: number }>
  abstract encrypt (codeHash: CodeHash, msg: Message): Promise<string>
}

/** Base class for transaction-bundling Agent for both Secret Network implementations. */
export abstract class ScrtBundle extends Bundle {
  static bundleCounter: number = 0
  declare agent: ScrtAgent
  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction bundle; don't execute it, but save it in
    * `receipts/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    // Number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the bundle
    log.bundleMessages(this.msgs, N)
    // The base Bundle class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptInit(init)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the bundle
    log.bundleMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages)
    // Output signing instructions to the console
    log.bundleSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!, this.agent.assertChain().id,
      accountNumber, sequence, unsigned
    )
    return { N, name, accountNumber, sequence, unsignedTxBody: JSON.stringify(unsigned) }
  }
  private async encryptInit (init: any): Promise<any> {
    const encrypted = await this.agent.encrypt(init.codeHash, init.msg)
    return {
      "@type":            "/secret.compute.v1beta1.MsgInstantiateContract",
      callback_code_hash: '',
      callback_sig:       null,
      sender:             init.sender,
      code_id:     String(init.codeId),
      init_funds:         init.funds,
      label:              init.label,
      init_msg:           encrypted,
    }
  }
  private async encryptExec (exec: any): Promise<any> {
    const encrypted = await this.agent.encrypt(exec.codeHash, exec.msg)
    return {
      "@type":            '/secret.compute.v1beta1.MsgExecuteContract',
      callback_code_hash: '',
      callback_sig:       null,
      sender:             exec.sender,
      contract:           exec.contract,
      sent_funds:         exec.funds,
      msg:                encrypted,
    }
  }
  private composeUnsignedTx (encryptedMessages: any[]): any {
    const fee = Scrt.gas(10000000)
    const gas = fee.gas
    const payer = ""
    const granter = ""
    const auth_info = { signer_infos: [], fee: { ...fee, gas, payer, granter }, }
    const signatures: any[] = []
    const body = {
      messages:                       encryptedMessages,
      memo:                           name,
      timeout_height:                 "0",
      extension_options:              [],
      non_critical_extension_options: []
    }
    return { auth_info, signatures, body }
  }

}

Scrt.Agent        = ScrtAgent  as unknown as AgentClass<ScrtAgent>
Scrt.Agent.Bundle = ScrtBundle as unknown as BundleClass<ScrtBundle>

///////////////////////////////////////////////////////////////////////////////////////////////////
/// # FADROMA CLIENT IMPLEMENTATION FOR SECRET NETWORK GRPC API ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Represents the Secret Network, accessed via gRPC API. */
export class ScrtGrpc extends Scrt {
  static SecretJS: typeof SecretJS = SecretJS
  static Config = ScrtGrpcConfig
  static defaultMainnetGrpcUrl = this.Config.defaultMainnetGrpcUrl
  static defaultTestnetGrpcUrl = this.Config.defaultTestnetGrpcUrl
  static Agent: AgentClass<ScrtGrpcAgent>
  /** Values of FADROMA_CHAIN provided by the ScrtGrpc implementation.
    * Devnets and mocknets are defined downstream in @fadroma/connect */
  static Chains = {
    async 'ScrtGrpcMainnet' (config: ScrtGrpcConfig) {
      const mode = Chain.Mode.Mainnet
      const id   = config.scrtMainnetChainId ?? Scrt.defaultMainnetChainId
      const url  = config.scrtMainnetGrpcUrl || ScrtGrpc.defaultMainnetGrpcUrl
      return new ScrtGrpc(id, { url, mode })
    },
    async 'ScrtGrpcTestnet' (config: ScrtGrpcConfig) {
      const mode = Chain.Mode.Testnet
      const id   = config.scrtTestnetChainId ?? Scrt.defaultTestnetChainId
      const url  = config.scrtTestnetGrpcUrl || ScrtGrpc.defaultTestnetGrpcUrl
      return new ScrtGrpc(id, { url, mode })
    },
  }
  constructor (...args: ConstructorParameters<typeof Scrt>) {
    super(...args)
    // Allow a different API-compatible version of SecretJS to be passed
    if (!!args[1] && typeof args[1] === 'object') {
      const {SecretJS: _SecretJS} = args[1] as {SecretJS: typeof SecretJS}
      this.SecretJS = _SecretJS ?? this.SecretJS
    }
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }
  /** The Agent class that this instance's getAgent method will instantiate. */
  Agent: AgentClass<ScrtGrpcAgent> =
    (this.constructor as ChainClass<Chain>).Agent as AgentClass<ScrtGrpcAgent>
  /** The SecretJS implementation used by this instance. */
  SecretJS = ScrtGrpc.SecretJS
  /** A fresh instance of the anonymous read-only API client. Memoize yourself. */
  get api () {
    return this.getApi()
  }
  async getBalance (denom = this.defaultDenom, address: Address) {
    const api = await this.api
    const response = await api.query.bank.balance({ address, denom })
    return response.balance!.amount
  }
  async getLabel (address: string): Promise<string> {
    const api = await this.api
    const { ContractInfo: { label } } = await api.query.compute.contractInfo(address)
    return label
  }
  async getCodeId (address: string): Promise<string> {
    const api = await this.api
    const { ContractInfo: { codeId } } = await api.query.compute.contractInfo(address)
    return codeId
  }
  async getHash (address: string|number): Promise<string> {
    const api = await this.api
    if (typeof address === 'number') {
      return await api.query.compute.codeHash(address)
    } else {
      return await api.query.compute.contractCodeHash(address)
    }
  }
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    throw new Error('TODO: Scrt#query: use same method on agent')
  }
  get block () {
    return this.api.then(api=>api.query.tendermint.getLatestBlock({}))
  }
  get height () {
    return this.block.then(block=>Number(block.block?.header?.height))
  }

  /** @returns a fresh instance of the anonymous read-only API client. */
  async getApi (options: object = {}): Promise<SecretJS.SecretNetworkClient> {
    return await this.SecretJS.SecretNetworkClient.create({
      chainId: this.id, grpcWebUrl: this.url, ...options
    })
  }
  /** Create a `ScrtGrpcAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtGrpcAgentOpts> = {},
    _Agent:  AgentClass<ScrtGrpcAgent> = this.Agent
  ): Promise<ScrtGrpcAgent> {
    // keypair option not supported
    if (options.keyPair) log.warnIgnoringKeyPair()
    // support creating agent for other Chain instance
    const chain: ScrtGrpc = (options.chain ?? this) as ScrtGrpc
    // use selected secretjs implementation
    const _SecretJS = chain.SecretJS ?? SecretJS
    // unwrap
    let { name, address, mnemonic, keyPair, wallet } = options
    // create wallet from mnemonic if not passed
    if (!wallet) {
      if (name && chain.isDevnet && chain.node) {
        await chain.node.respawn()
        mnemonic = (await chain.node.getGenesisAccount(name)).mnemonic
      }
      if (mnemonic) {
        wallet = new _SecretJS.Wallet(mnemonic)
      } else {
        throw new ScrtError.NoWalletOrMnemonic()
      }
    } else {
      if (mnemonic) {
        log.warnIgnoringMnemonic()
      }
    }
    // construct options object
    options = {
      ...options,
      SecretJS: _SecretJS,
      wallet,
      api: await this.getApi({
        chainId:    chain.id,
        grpcWebUrl: chain.url,
        wallet,
        walletAddress: wallet.address || address
      })
    }
    // construct agent
    return await super.getAgent(options, _Agent) as ScrtGrpcAgent
  }
}

/** gRPC-specific configuration options. */
export interface ScrtGrpcAgentOpts extends ScrtAgentOpts {
  wallet:    SecretJS.Wallet
  url:       string
  api:       SecretJS.SecretNetworkClient
  simulate?: boolean
  // Allow a different version of SecretJS to be passed
  SecretJS?: typeof SecretJS
}

export type ScrtGrpcTxResult = SecretJS.Tx

export class ScrtGrpcAgent extends ScrtAgent {
  static Bundle: BundleClass<ScrtBundle> // populated below with ScrtGrpcBundle
  static SecretJS = ScrtGrpc.SecretJS
  constructor (options: Partial<ScrtGrpcAgentOpts>) {
    super(options)
    if (!options.wallet) throw new ScrtError.NoWallet()
    if (!options.api)    throw new ScrtError.NoApi()
    this.wallet   = options.wallet
    this.api      = options.api
    this.address  = this.wallet?.address
    this.simulate = options.simulate ?? this.simulate
    if (options.SecretJS) this.SecretJS = options.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }
  Bundle: BundleClass<ScrtBundle> = ScrtGrpcAgent.Bundle
  SecretJS = ScrtGrpcAgent.SecretJS
  wallet:    SecretJS.Wallet
  api:       SecretJS.SecretNetworkClient
  simulate?: boolean = true
  get account () {
    if (!this.address) throw new Error("No address")
    return this.api.query.auth.account({ address: this.address })
  }
  get balance () {
    if (!this.address) throw new Error("No address")
    return this.getBalance(this.defaultDenom, this.address)
  }
  async getBalance (denom = this.defaultDenom, address: Address) {
    const response = await this.api.query.bank.balance({ address, denom })
    return response.balance!.amount
  }
  async send (to: Address, amounts: ICoin[], opts?: any) {
    if (!this.address) throw new Error("No address")
    return this.api.tx.bank.send({
      fromAddress: this.address,
      toAddress:   to,
      amount:      amounts
    }, {
      gasLimit: opts?.gas?.gas
    })
  }
  async sendMany (outputs: never, opts: never) {
    throw new Error('ScrtAgent#sendMany: not implemented')
  }
  async getLabel (address: string): Promise<string> {
    const { ContractInfo: { label } } = await this.api.query.compute.contractInfo(address)
    return label
  }
  async getCodeId (address: string): Promise<string> {
    const { ContractInfo: { codeId } } = await this.api.query.compute.contractInfo(address)
    return codeId
  }
  async getHash (address: string): Promise<string> {
    return await this.api.query.compute.contractCodeHash(address)
  }
  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    if (!this.address) throw new Error("No address")
    const { account } =
      (await this.api.query.auth.account({ address: this.address, }))
      ?? (()=>{throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`,)})()
    const { accountNumber, sequence } =
      account as { accountNumber: string, sequence: string }
    return { accountNumber: Number(accountNumber), sequence: Number(sequence) }
  }
  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) throw new ScrtError.NoCodeHash()
    const { encryptionUtils } = await this.api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    const { address: contractAddress, codeHash } = instance
    const args = { contractAddress, codeHash, query: query as Record<string, unknown> }
    // @ts-ignore
    return await this.api.query.compute.queryContract(args) as U
  }
  async upload (data: Uint8Array): Promise<Contract<any>> {
    type Log = { type: string, key: string }
    if (!this.address) throw new Error("No address")
    const sender     = this.address
    const args       = {sender, wasmByteCode: data, source: "", builder: ""}
    const gasLimit   = Number(Scrt.defaultFees.upload.amount[0].amount)
    const result     = await this.api.tx.compute.storeCode(args, { gasLimit })
    const findCodeId = (log: Log) => log.type === "message" && log.key === "code_id"
    const codeId     = result.arrayLog?.find(findCodeId)?.value
    const codeHash   = await this.api.query.compute.codeHash(Number(codeId))
    const chainId    = this.assertChain().id
    const contract   = new Contract({
      agent: this,
      codeHash,
      chainId,
      codeId,
      uploadTx: result.transactionHash
    })
    return contract
  }
  async instantiate (
    template: Contract<any>,
    label:    Label,
    initMsg:  Message,
    initFunds = []
  ): Promise<Contract<any>> {
    if (!this.address) throw new Error("No address")
    const { chainId, codeId, codeHash } = template
    if (chainId && chainId !== this.assertChain().id) throw new ScrtError.WrongChain()
    if (isNaN(Number(codeId)))     throw new ScrtError.NoCodeId()
    const sender   = this.address
    const args     = { sender, codeId: Number(codeId), codeHash, initMsg, label, initFunds }
    const gasLimit = Number(Scrt.defaultFees.init.amount[0].amount)
    const result   = await this.api.tx.compute.instantiateContract(args, { gasLimit })
    if (!result.arrayLog) {
      throw Object.assign(
        new Error(`SecretRPCAgent#instantiate: ${result.rawLog}`), {
          jsonLog: result.jsonLog
        }
      )
    }
    type Log = { type: string, key: string }
    const findAddr = (log: Log) => log.type === "message" && log.key === "contract_address"
    const address  = result.arrayLog.find(findAddr)?.value!
    const initTx   = result.transactionHash
    return Object.assign(template, { address })
  }
  async instantiateMany (template: Contract<any>, configs: DeployArgs[]) {
    // instantiate multiple contracts in a bundle:
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(template, configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const instance = instances[i]
      if (instance) {
        instance.codeId   = template.codeId
        instance.codeHash = template.codeHash
        instance.label    = configs[i][0]
      }
    }
    return instances
  }
  async execute (
    instance: Partial<Client>, msg: Message, opts: ExecOpts = {}
  ): Promise<ScrtGrpcTxResult> {
    if (!this.address) throw new Error("No address")
    const { address, codeHash } = instance
    const { send, memo, fee = this.fees.exec } = opts
    if (memo) log.warnNoMemos()
    const tx = {
      sender:          this.address,
      contractAddress: address!,
      codeHash,
      msg:             msg as Record<string, unknown>,
      sentFunds:       send
    }
    const txOpts = {
      gasLimit: Number(fee.amount[0].amount)
    }
    if (this.simulate) {
      this.log.info('Simulating transaction...')
      const simResult = await this.api.tx.compute.executeContract.simulate(tx, txOpts)
      this.log.info('Simulation result of', { tx, txOpts }, 'from', this, 'is', simResult)
    }
    const result = await this.api.tx.compute.executeContract(tx, txOpts)
    // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
    if (result.code !== 0) {
      const error = `ScrtAgent#execute: gRPC error ${result.code}: ${result.rawLog}`
      // make the original result available on request
      const original = structuredClone(result)
      Object.defineProperty(result, "original", {
        enumerable: false,
        get () { return original }
      })
      // decode the values in the result
      const txBytes = tryDecode(result.txBytes)
      Object.assign(result, { txBytes })
      for (const i in result.tx.signatures) {
        //@ts-ignore
        result.tx.signatures[i] = tryDecode(result.tx.signatures[i])
      }
      for (const event of result.events) {
        for (const attr of event.attributes) {
          //@ts-ignore
          try { attr.key   = tryDecode(attr.key)   } catch (e) {}
          //@ts-ignore
          try { attr.value = tryDecode(attr.value) } catch (e) {}
        }
      }
      throw Object.assign(new Error(error), result)
    }
    return result as ScrtGrpcTxResult
  }
}

/** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
const decoder = new TextDecoder('utf-8', { fatal: true })

/** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
export const nonUtf8 = Symbol('<binary data, see result.original for the raw Uint8Array>')

/** Decode binary response data or mark it as non-UTF8 */
const tryDecode = (data: Uint8Array): string|Symbol => {
  try {
    return decoder.decode(data)
  } catch (e) {
    return nonUtf8
  }
}

export class ScrtGrpcBundle extends ScrtBundle {

  static SecretJS = ScrtGrpcAgent.SecretJS

  constructor (agent: ScrtAgent) {
    super(agent)
    this.SecretJS = (agent as ScrtGrpcAgent).SecretJS ?? this.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  declare agent: ScrtGrpcAgent

  SecretJS = ScrtGrpcBundle.SecretJS

  async submit (memo = ""): Promise<ScrtBundleResult[]> {
    const chainId = this.assertChain().id
    const results: ScrtBundleResult[] = []
    const msgs  = await this.conformedMsgs
    const limit = Number(Scrt.defaultFees.exec.amount[0].amount)
    const gas   = msgs.length * limit
    try {
      const agent = this.agent as unknown as ScrtGrpcAgent
      const txResult = await agent.api.tx.broadcast(msgs, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in bundle): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBundleResult> = {}
        result.sender  = this.address
        result.tx      = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof this.SecretJS.MsgInstantiateContract) {
          type Log = { msg: number, type: string, key: string }
          const findAddr = ({msg, type, key}: Log) =>
            msg  ==  Number(i) &&
            type === "message" &&
            key  === "contract_address"
          result.type    = 'wasm/MsgInstantiateContract'
          result.codeId  = msg.codeId
          result.label   = msg.label
          result.address = txResult.arrayLog?.find(findAddr)?.value
        }
        if (msg instanceof this.SecretJS.MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBundleResult
      }
    } catch (err) {
      log.submittingBundleFailed(err)
      throw err
    }
    return results
  }

  async simulate () {
    const { api } = this.agent as ScrtGrpcAgent
    return await api.tx.simulate(await this.conformedMsgs)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    return Promise.all(this.assertMessages().map(async ({init, exec})=>{
      if (init) return new this.SecretJS.MsgInstantiateContract({
        sender:          init.sender,
        codeId:          init.codeId,
        codeHash:        init.codeHash,
        label:           init.label,
        initMsg:         init.msg,
        initFunds:       init.funds,
      })
      if (exec) return new this.SecretJS.MsgExecuteContract({
        sender:          exec.sender,
        contractAddress: exec.contract,
        codeHash:        exec.codeHash,
        msg:             exec.msg,
        sentFunds:       exec.funds,
      })
      throw 'unreachable'
    }))
  }

}

export interface ScrtBundleClass <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

export type ScrtBundleMessage =
  |SecretJS.MsgInstantiateContract
  |SecretJS.MsgExecuteContract<object>

export interface ScrtBundleResult {
  sender?:   Address
  tx:        TxHash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}

ScrtGrpc.Agent        = ScrtGrpcAgent  as unknown as AgentClass<ScrtGrpcAgent>
ScrtGrpc.Agent.Bundle = ScrtGrpcBundle as unknown as BundleClass<ScrtGrpcBundle>
Object.defineProperty(ScrtGrpcAgent,  'SecretJS', { enumerable: false, writable: true })
Object.defineProperty(ScrtGrpcBundle, 'SecretJS', { enumerable: false, writable: true })

/** Data used for creating a signature as per the SNIP-24 spec:
  * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
  * This type is case sensitive! */
export interface SignDoc {
  readonly chain_id:       string;
  /** Always 0. */
  readonly account_number: string;
  /** Always 0. */
  readonly sequence:       string;
  /** Always 0 uscrt + 1 gas */
  readonly fee:            IFee;
  /** Always 1 message of type query_permit */
  readonly msgs:           readonly AminoMsg[];
  /** Always empty. */
  readonly memo:           string;
}

export function createSignDoc <T> (
  chain_id:   ChainId,
  permit_msg: T
) {
  return {
    chain_id,
    account_number: "0", // Must be 0
    sequence: "0", // Must be 0
    fee: {
      amount: [{ denom: "uscrt", amount: "0" }], // Must be 0 uscrt
      gas: "1", // Must be 1
    },
    msgs: [
      {
        type: "query_permit", // Must be "query_permit"
        value: permit_msg,
      },
    ],
    memo: "", // Must be empty
  }
}

export interface Signer {
  chain_id: ChainId
  address:  Address
  sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
}

export class KeplrSigner implements Signer {

  constructor (
    /** The id of the chain which permits will be signed for. */
    readonly chain_id: ChainId,
    /** The address which will do the signing and
      * which will be the address used by the contracts. */
    readonly address:  Address,
    /** Must be a pre-configured instance. */
    readonly keplr:    KeplrSigningHandle<any>
  ) {}

  async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {

    const { signature } = await this.keplr.signAmino(
      this.chain_id,
      this.address,
      createSignDoc(this.chain_id, permit_msg),
      {
        preferNoSetFee: true,  // Fee must be 0, so hide it from the user
        preferNoSetMemo: true, // Memo must be empty, so hide it from the user
      }
    )

    return {
      params: {
        chain_id:       this.chain_id,
        allowed_tokens: permit_msg.allowed_tokens,
        permit_name:    permit_msg.permit_name,
        permissions:    permit_msg.permissions
      },
      signature
    }

  }

}

export interface KeplrSigningHandle <T> {
  signAmino (
    chain_id: ChainId,
    address:  Address,
    signDoc:  SignDoc,
    options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
  ): Promise<Permit<T>>
}

export interface Permit<T> {
  params: {
    permit_name:    string,
    allowed_tokens: Address[]
    chain_id:       string,
    permissions:    T[]
  },
  signature: Signature
}

// This type is case sensitive!
export interface Signature {
  readonly pub_key: Pubkey
  readonly signature: string
}

export interface Pubkey {
  /** Must be: `tendermint/PubKeySecp256k1` */
  readonly type: string
  readonly value: any
}

export interface AminoMsg {
  readonly type: string;
  readonly value: any;
}

/** Used as the `value` field of the {@link AminoMsg} type. */
export interface PermitAminoMsg<T> {
  permit_name:    string,
  allowed_tokens: Address[],
  permissions:    T[],
}

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  async create (entropy = randomBytes(32).toString("hex")) {
    const msg    = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) data = [data]
    return data[0]
  }

  async set (key: unknown) {
    return this.execute({ set_viewing_key: { key } })
  }

}

const log = new ScrtConsole()

/** Allow Scrt clients to be implemented with just `@fadroma/scrt` */
export * from '@fadroma/client'

/** Expose default version of secretjs */
export { SecretJS }

/** Expose configuration objects. */
export { ScrtConfig, ScrtGrpcConfig }

/** Expose console and error objects */

export { ScrtError, ScrtConsole }

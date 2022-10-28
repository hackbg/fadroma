/*
  Fadroma Platform Package for Secret Network with gRPC/Protobuf API
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

import { base64, randomBytes, bip39, bip39EN } from '@hackbg/formati'
import type {
  Address, CodeHash, CodeId, TxHash, Uint128,
  AgentClass, AgentOpts,
  BundleClass,
  ChainClass, ChainOpts, ChainId,
  DeployArgs, Label, Message,
  ExecOpts, ICoin, IFee,
} from '@fadroma/client'
import { Agent, Bundle, Chain, Client, Contract, Fee } from '@fadroma/client'
import { ScrtError, ScrtConsole, ScrtConfig, Scrt, ScrtAgent, ScrtBundle } from '@fadroma/scrt'
import type { ScrtAgentOpts } from '@fadroma/scrt'
import * as SecretJS from 'secretjs'

/** gRPC-specific Secret Network settings. */
export class ScrtGrpcConfig extends ScrtConfig {
  static defaultMainnetGrpcUrl: string = 'https://secret-4.api.trivium.network:9091'
  static defaultTestnetGrpcUrl: string = 'https://grpc.testnet.secretsaturn.net'
  scrtMainnetGrpcUrl: string|null
    = this.getString('SCRT_MAINNET_GRPC_URL',  ()=>ScrtGrpcConfig.defaultMainnetGrpcUrl)
  scrtTestnetGrpcUrl: string|null
    = this.getString('SCRT_TESTNET_GRPC_URL',  ()=>ScrtGrpcConfig.defaultTestnetGrpcUrl)
}

/** Represents the Secret Network, accessed via gRPC/Protobuf. */
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
  constructor (
    id: ChainId = Scrt.defaultMainnetChainId,
    options: Partial<ScrtGrpcOpts> = {
      url:  ScrtGrpc.defaultMainnetGrpcUrl,
      mode: Chain.Mode.Mainnet
    }
  ) {
    super(id, options)
    // Optional: Allow a different API-compatible version of SecretJS to be passed
    this.SecretJS = options.SecretJS ?? this.SecretJS
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
  async getApi (
    options: Partial<SecretJS.CreateClientOptions> = {}
  ): Promise<SecretJS.SecretNetworkClient> {
    return await this.SecretJS.SecretNetworkClient.create({
      chainId:    this.id,
      grpcWebUrl: this.url,
      ...options
    })
  }
  /** Create a `ScrtGrpcAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtGrpcAgentOpts> = {},
    _Agent:  AgentClass<ScrtGrpcAgent> = this.Agent
  ): Promise<ScrtGrpcAgent> {
    // Not supported: passing a keypair like scrt-amino
    if (options.keyPair) this.log.warnIgnoringKeyPair()
    // Support creating agent for other Chain instance; TODO remove?
    const chain: ScrtGrpc = (options.chain ?? this) as ScrtGrpc
    // Use selected secretjs implementation
    const _SecretJS = chain.SecretJS ?? SecretJS
    // Unwrap base options
    let { name, address, mnemonic, wallet, fees } = options
    // Create wallet from mnemonic if a wallet is not passed
    if (!wallet) {
      if (name && chain.isDevnet && chain.node) {
        await chain.node.respawn()
        mnemonic = (await chain.node.getGenesisAccount(name)).mnemonic
      }
      if (!mnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.warnGeneratedMnemonic(mnemonic)
      }
      wallet = new _SecretJS.Wallet(mnemonic)
    } else if (mnemonic) {
      this.log.warnIgnoringMnemonic()
    }
    // Construct the API client
    const api = await this.getApi({
      chainId:         chain.id,
      grpcWebUrl:      chain.url,
      wallet,
      walletAddress:   wallet.address || address,
      encryptionUtils: options.encryptionUtils
    })
    // If fees are not specified, get default fees from API
    if (!fees) {
      fees = Scrt.defaultFees
      try {
        const { param } = await api.query.params.params({ subspace: "baseapp", key: "BlockParams" })
        const { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
        fees = {
          upload: Scrt.gas(max_gas),
          init:   Scrt.gas(max_gas),
          exec:   Scrt.gas(max_gas),
          send:   Scrt.gas(max_gas),
        }
      } catch (e) {
        this.log.warn(e)
        this.log.warnCouldNotFetchBlockLimit(Object.values(fees))
      }
    }
    // Construct final options object
    options = { ...options, name, address, mnemonic, api, wallet, fees }
    // Don't pass this down to the agent options because the API should already have it
    delete options.encryptionUtils
    // Construct agent
    return await super.getAgent(options, _Agent) as ScrtGrpcAgent
  }
}

export interface ScrtGrpcOpts extends ChainOpts {
  /** You can set this to a compatible version of the SecretJS module
    * in order to use it instead of the one bundled with this package.
    * This setting is per-chain, i.e. all ScrtGrpcAgent instances
    * constructed by the configured ScrtGrpc instance's getAgent method
    * will use the non-default SecretJS module. */
  SecretJS: typeof SecretJS
}

/** gRPC-specific configuration options. */
export interface ScrtGrpcAgentOpts extends ScrtAgentOpts {
  /** Instance of the underlying platform API provided by `secretjs`. */
  api:             SecretJS.SecretNetworkClient
  /** This agent's identity on the chain. */
  wallet:          SecretJS.Wallet
  /** Whether to simulate each execution first to get a more accurate gas estimate. */
  simulate:        boolean
  /** Set this to override the instance of the Enigma encryption utilities,
    * e.g. the one provided by Keplr. Since this is provided by Keplr on a
    * per-identity basis, this override is specific to each individual
    * ScrtGrpcAgent instance. */
  encryptionUtils: SecretJS.EncryptionUtils
}

export type ScrtGrpcTxResult = SecretJS.Tx

export class ScrtGrpcAgent extends ScrtAgent {
  static Bundle: BundleClass<ScrtBundle> // populated below with ScrtGrpcBundle
  constructor (options: Partial<ScrtGrpcAgentOpts>) {
    super(options)
    this.fees = options.fees ?? this.fees
    // Required: SecretJS.SecretNetworkClient instance
    if (!options.api) throw new ScrtError.NoApi()
    this.api = options.api
    // Required: SecretJS.Wallet instance
    if (!options.wallet) throw new ScrtError.NoWallet()
    this.wallet  = options.wallet
    this.address = this.wallet?.address
    // Optional: override api.encryptionUtils (e.g. with the ones from Keplr).
    // Redundant if agent is constructed with ScrtGrpc#getAgent
    // (which applies the override that the time of SecretNetworkClient construction)
    if (options.encryptionUtils) {
      Object.assign(this.api, { encryptionUtils: options.encryptionUtils })
    }
    // Optional: enable simulation to establish gas amounts
    this.simulate = options.simulate ?? this.simulate
  }
  log = new ScrtConsole('ScrtGrpcAgent')
  Bundle: BundleClass<ScrtBundle> = ScrtGrpcAgent.Bundle
  wallet: SecretJS.Wallet
  api: SecretJS.SecretNetworkClient
  simulate: boolean = false
  get account () {
    return this.api.query.auth.account({ address: this.assertAddress() })
  }
  get balance () {
    return this.getBalance(this.defaultDenom, this.assertAddress())
  }
  async getBalance (denom = this.defaultDenom, address: Address) {
    const response = await this.api.query.bank.balance({ address, denom })
    return response.balance!.amount
  }
  async send (to: Address, amounts: ICoin[], opts?: any) {
    return this.api.tx.bank.send({
      fromAddress: this.assertAddress(),
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
    if (memo) this.log.warnNoMemos()
    const tx = {
      sender:          this.address,
      contractAddress: address!,
      codeHash,
      msg:             msg as Record<string, unknown>,
      sentFunds:       send
    }
    const txOpts = {
      gasLimit: Number(fee.gas)
    }
    if (this.simulate) {
      this.log.info('Simulating transaction...')
      let simResult
      try {
        simResult = await this.api.tx.compute.executeContract.simulate(tx, txOpts)
      } catch (e) {
        this.log.error(e)
        this.log.warn('TX simulation failed:', tx, 'from', this)
      }
      if (simResult?.gasInfo?.gasUsed) {
        this.log.info('Simulation used gas:', simResult.gasInfo.gasUsed)
        const gas = Math.ceil(Number(simResult.gasInfo.gasUsed) * 1.1)
        // Adjust gasLimit up by 10% to account for gas estimation error
        this.log.info('Setting gas to 110% of that:', gas)
        txOpts.gasLimit = gas
      }
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
  log = new ScrtConsole('ScrtGrpcBundle')

  constructor (agent: ScrtGrpcAgent) {
    super(agent)
    // Optional: override SecretJS implementation
    this.SecretJS = (agent?.chain as ScrtGrpc).SecretJS ?? this.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** The agent which will broadcast the bundle. */
  declare agent: ScrtGrpcAgent

  /** The SecretJS module from which message objects are created. */
  private SecretJS = ScrtGrpc.SecretJS

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
      this.log.submittingBundleFailed(err)
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

ScrtGrpc.Agent        = ScrtGrpcAgent  as unknown as AgentClass<ScrtGrpcAgent>
ScrtGrpc.Agent.Bundle = ScrtGrpcBundle as unknown as BundleClass<ScrtGrpcBundle>
Object.defineProperty(ScrtGrpcAgent,  'SecretJS', { enumerable: false, writable: true })
Object.defineProperty(ScrtGrpcBundle, 'SecretJS', { enumerable: false, writable: true })

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

/** Expose default version of secretjs */
export { SecretJS }

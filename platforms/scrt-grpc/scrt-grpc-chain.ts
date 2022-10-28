import type * as SecretJS from 'secretjs'
import { bip39, bip39EN } from '@hackbg/formati'
import { Scrt, Chain } from '@fadroma/scrt'
import type { ChainId, ChainClass, ChainOpts, AgentClass, Address, Client, Message } from '@fadroma/scrt'
import { ScrtGrpcConfig } from './scrt-grpc-config'
import type { ScrtGrpcAgent, ScrtGrpcAgentOpts } from './scrt-grpc-agent'

export interface ScrtGrpcOpts extends ChainOpts {
  /** You can set this to a compatible version of the SecretJS module
    * in order to use it instead of the one bundled with this package.
    * This setting is per-chain, i.e. all ScrtGrpcAgent instances
    * constructed by the configured ScrtGrpc instance's getAgent method
    * will use the non-default SecretJS module. */
  SecretJS: typeof SecretJS
}

/** Represents the Secret Network, accessed via gRPC/Protobuf. */
export class ScrtGrpc extends Scrt {
  /** The SecretJS module to use. */
  static SecretJS: typeof SecretJS
  /** The configuration class to use. */
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
    const _SecretJS = chain.SecretJS ?? await import('secretjs')
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

import type * as SecretJS from 'secretjs'
import { bip39, bip39EN } from '@hackbg/formati'
import { Chain, Fee } from '@fadroma/client'
import type { AgentClass, Uint128 } from '@fadroma/client'
import { ScrtConfig } from './scrt-config'
import type { ScrtAgent } from './scrt-agent'
import { ScrtConsole } from './scrt-events'

export interface ScrtOpts extends ChainOpts {
  /** You can set this to a compatible version of the SecretJS module
    * in order to use it instead of the one bundled with this package.
    * This setting is per-chain, i.e. all ScrtAgent instances
    * constructed by the configured Scrt instance's getAgent method
    * will use the non-default SecretJS module. */
  SecretJS: typeof SecretJS
}

/** Represents a Secret Network API endpoint. */
export class Scrt extends Chain {

  /** The default SecretJS module. */
  static SecretJS: typeof SecretJS

  /** The default Config class for Secret Network. */
  static Config = ScrtConfig

  /** The default Agent class for Secret Network. */
  static Agent: AgentClass<ScrtAgent> // set below

  static async Mainnet (config: ScrtConfig) {
    const mode = Chain.Mode.Mainnet
    const id   = config.scrtMainnetChainId ?? Scrt.defaultMainnetChainId
    const url  = config.scrtMainnetUrl || Scrt.defaultMainnetUrl
    return new Scrt(id, { url, mode })
  }

  static async Testnet (config: ScrtConfig) {
    const mode = Chain.Mode.Testnet
    const id   = config.scrtTestnetChainId ?? Scrt.defaultTestnetChainId
    const url  = config.scrtTestnetUrl || Scrt.defaultTestnetGrpcUrl
    return new Scrt(id, { url, mode })
  }

  static defaultMainnetUrl:     string  = this.Config.defaultMainnetUrl

  static defaultTestnetUrl:     string  = this.Config.defaultTestnetUrl

  static defaultMainnetChainId: ChainId = this.Config.defaultMainnetChainId

  static defaultTestnetChainId: ChainId = this.Config.defaultTestnetChainId

  static isSecretNetwork:       boolean = true

  static defaultDenom:         string  = 'uscrt'

  static gas (amount: Uint128|number) {
    return new Fee(amount, this.defaultDenom)
  }

  static defaultFees = {
    upload: this.gas(1000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

  Agent:           AgentClass<ScrtAgent> = Scrt.Agent

  isSecretNetwork: boolean = true

  defaultDenom:    string  = Scrt.defaultDenom

  log = new ScrtConsole('Scrt')

  constructor (
    id: ChainId = Scrt.defaultMainnetChainId,
    options: Partial<ScrtOpts> = {
      url:  Scrt.defaultMainnetUrl,
      mode: Chain.Mode.Mainnet
    }
  ) {
    super(id, options)
    // Optional: Allow a different API-compatible version of SecretJS to be passed
    this.SecretJS = options.SecretJS ?? this.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** The Agent class that this instance's getAgent method will instantiate. */
  Agent: AgentClass<ScrtAgent> =
    (this.constructor as ChainClass<Chain>).Agent as AgentClass<ScrtAgent>

  /** The SecretJS implementation used by this instance. */
  SecretJS = Scrt.SecretJS

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

  /** Create a `ScrtAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtAgentOpts> = {},
    _Agent:  AgentClass<ScrtAgent> = this.Agent
  ): Promise<ScrtAgent> {
    // Not supported: passing a keypair like scrt-amino
    if (options.keyPair) this.log.warnIgnoringKeyPair()
    // Support creating agent for other Chain instance; TODO remove?
    const chain: Scrt = (options.chain ?? this) as Scrt
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
    return await super.getAgent(options, _Agent) as ScrtAgent
  }

}

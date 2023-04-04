import Error from './ScrtError'
import Console from './ScrtConsole'
import Config from './ScrtConfig'
import type ScrtAgent from './ScrtAgent'
import type { ScrtAgentOpts } from './ScrtAgent'

import type * as SecretJS from 'secretjs'

import { Chain, Fee } from '@fadroma/agent'
import type {
  Address, AgentClass, AgentFees, ChainClass, ChainId, ChainOpts, Client, Message, Uint128
} from '@fadroma/agent'

import { bip39, bip39EN } from '@hackbg/4mat'

export interface ScrtOpts extends ChainOpts {
  /** You can set this to a compatible version of the SecretJS module
    * in order to use it instead of the one bundled with this package.
    * This setting is per-chain, i.e. all ScrtAgent instances
    * constructed by the configured Scrt instance's getAgent method
    * will use the non-default SecretJS module. */
  SecretJS: typeof SecretJS
}

/** Represents a Secret Network API endpoint. */
export default class Scrt extends Chain {

  /** Connect to the Secret Network Mainnet. */
  static Mainnet (config?: Config) {
    return new Scrt(config?.mainnetChainId ?? Scrt.Config.defaultMainnetChainId, {
      mode: Chain.Mode.Mainnet,
      url:  config?.mainnetUrl || Scrt.Config.defaultMainnetUrl,
    })
  }

  /** Connect to the Secret Network Testnet. */
  static Testnet (config?: Config) {
    return new Scrt(config?.testnetChainId ?? Scrt.Config.defaultTestnetChainId, {
      mode: Chain.Mode.Testnet,
      url:  config?.testnetUrl || Scrt.Config.defaultTestnetUrl,
    })
  }

  /** The default SecretJS module. */
  static SecretJS: typeof SecretJS

  /** The default Config class for Secret Network. */
  static Config = Config

  /** The default Agent class for Secret Network. */
  static Agent: AgentClass<ScrtAgent> // set below

  static isSecretNetwork: boolean = true

  static defaultDenom: string  = 'uscrt'

  static gas (amount: Uint128|number) {
    return new Fee(amount, this.defaultDenom)
  }

  static defaultFees: AgentFees = {
    upload: this.gas(1000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

  /** The SecretJS module used by this instance.
    * Override this if you want to use another version of SecretJS. */
  SecretJS = Scrt.SecretJS

  /** The Agent class used by this instance. */
  Agent: AgentClass<ScrtAgent> = Scrt.Agent

  isSecretNetwork: boolean = true

  defaultDenom: string = Scrt.defaultDenom

  log = new Console('Scrt')

  constructor (
    id: ChainId = Scrt.Config.defaultMainnetChainId,
    options: Partial<ScrtOpts> = {
      url:  Scrt.Config.defaultMainnetUrl,
      mode: Chain.Mode.Mainnet
    }
  ) {
    super(id, options)
    // Optional: Allow a different API-compatible version of SecretJS to be passed
    this.SecretJS = options.SecretJS ?? this.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** The Agent class that this instance's getAgent method will instantiate. */

  /** A fresh instance of the anonymous read-only API client. Memoize yourself. */
  get api () {
    return this.getApi()
  }

  async getBalance (denom = this.defaultDenom, address: Address) {
    const api = await this.api
    const response = await api.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async getLabel (contract_address: string): Promise<string> {
    const api = await this.api
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: string): Promise<string> {
    const api = await this.api
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getHash (arg: string|number): Promise<string> {
    const api = await this.api
    if (typeof arg === 'number' || !isNaN(Number(arg))) {
      return (await api.query.compute.codeHashByCodeId({
        code_id: String(arg)
      })).code_hash!
    } else {
      return (await api.query.compute.codeHashByContractAddress({
        contract_address: arg
      })).code_hash!
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
    options = { chainId: this.id, url: this.url, ...options }
    if (!options.url) throw new Error.NoApiUrl()
    return await new (this.SecretJS.SecretNetworkClient)(options as SecretJS.CreateClientOptions)
  }

  /** Create a `ScrtAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtAgentOpts> = {},
    _Agent:  AgentClass<ScrtAgent> = this.Agent
  ): Promise<ScrtAgent> {
    if (options.keyPair) this.log.warnIgnoringKeyPair()
    // Support creating agent for other Chain instance; TODO remove?
    const chain: Scrt = (options.chain ?? this) as Scrt
    // Use selected secretjs implementation
    const _SecretJS = chain.SecretJS
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
      console.log({chain})
      wallet = new _SecretJS.Wallet(mnemonic)
    } else if (mnemonic) {
      this.log.warnIgnoringMnemonic()
    }
    // Construct the API client
    let url = chain.url
    if (url.endsWith('/')) url = url.slice(0, url.length - 1)
    const api = await this.getApi({
      chainId:         chain.id,
      url:             url,
      wallet,
      walletAddress:   wallet.address || address,
      encryptionUtils: options.encryptionUtils
    })
    // If fees are not specified, get default fees from API
    if (!fees) {
      fees = Scrt.defaultFees
      try {
        const { param } = await api.query.params.params({ subspace: "baseapp", key: "BlockParams" })
        let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
        this.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
        if (max_gas < 0) {
          max_gas = 10000000
          this.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
        }
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

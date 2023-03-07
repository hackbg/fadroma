import Error from './ConnectError'
import Console from './ConnectConsole'
import Connector from './Connector'
import type { ConnectorClass } from './Connector'

import type { ChainRegistry, ChainId, Agent, AgentOpts } from '@fadroma/core'
import { ChainMode, Chain } from '@fadroma/core'
import { Scrt } from '@fadroma/scrt'
import { DevnetConfig } from '@fadroma/devnet'

import { EnvConfig } from '@hackbg/conf'
import type { Env } from '@hackbg/conf'

/** Connection configuration and Connector factory.
  * Factory pattern and consequent inversion of control
  * here imposed by the lack of `await new` */
export default class ConnectConfig extends EnvConfig {

  constructor (
    defaults: Partial<ConnectConfig> = {},
    readonly env: Env    = {},
    readonly cwd: string = '',
  ) {
    super(env, cwd)
    this.override(defaults)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
  }

  log = new Console('@fadroma/connect')

  /** Name of chain to use. */
  chainSelector?: keyof ChainRegistry = this.getString('FADROMA_CHAIN', ()=>undefined)

  /** Secret Network configuration. */
  scrt = new Scrt.Config(this.env, this.cwd)

  /** Devnets configuration. */
  devnet = new DevnetConfig(this.env, this.cwd)

  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  devnetAgentName: string
    = this.getString('FADROMA_AGENT',   ()=>
      this.getString('SCRT_AGENT_NAME', ()=> 'ADMIN'))

  /** Mnemonic to use for authentication. Hidden by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC',    ()=>
      this.getString('SCRT_AGENT_MNEMONIC', ()=> undefined))

  /** Get a chain ID corresponding to the value of `this.chain`.
    * (Used by subclasses to include chain ID in paths.) */
  get chainId (): ChainId {
    const chainIds = {
      Mocknet_CW0: 'mocknet-cw0',
      Mocknet_CW1: 'mocknet-cw1',
      ScrtDevnet:   'fadroma-devnet',
      ScrtTestnet:  Scrt.defaultTestnetChainId,
      ScrtMainnet:  Scrt.defaultMainnetChainId,
    }
    if (!this.chainSelector) throw new Error.NoChainSelected(chainIds)
    const result = chainIds[this.chainSelector as keyof typeof chainIds]
    if (!result) throw new Error.UnknownChainSelected(this.chainSelector, chainIds)
    return result
  }

  /** Get a chain mode corresponding to the value of `this.chain`.
    * (Used by settings to dispatch on chain mode.) */
  get chainMode (): ChainMode {
    const chainModes = {
      Mocknet_CW0: ChainMode.Mocknet,
      Mocknet_CW1: ChainMode.Mocknet,
      ScrtDevnet:  ChainMode.Devnet,
      ScrtTestnet: ChainMode.Testnet,
      ScrtMainnet: ChainMode.Mainnet,
    }
    if (!this.chainSelector) throw new Error.NoChainSelected(chainModes)
    const result = chainModes[this.chainSelector as keyof typeof chainModes]
    if (!result) throw new Error.UnknownChainSelected(this.chainSelector, chainModes)
    return result
  }

  // Create the Chain instance specified by the configuration.
  async getChain <C extends Chain> (
    getChain: keyof ChainRegistry|ChainRegistry[keyof ChainRegistry]|undefined = this.chainSelector
  ): Promise<C> {

    if (!getChain) {
      getChain = this.chainSelector
      if (!getChain) throw new Error.NoChain()
    }

    if (typeof getChain === 'string') { // allow name to be passed
      getChain = Chain.variants[getChain]
    }

    if (!getChain) { // if still unspecified, throw
      throw new Error.UnknownChainSelected(this.chainSelector!, Chain.variants)
    }

    return await Promise.resolve(getChain(this)) as C // create Chain object

  }

  async getAgent <A extends Agent> (chain?: Chain): Promise<A> {
    chain ??= await this.getChain()
    // Create the Agent instance as identified by the configuration.
    let agentOpts: AgentOpts = { chain }
    if (chain.isDevnet) {
      // On devnet, agent can be created from genesis account
      agentOpts.name = this.devnetAgentName
    } else {
      // Otherwise it's created from mnemonic
      agentOpts.mnemonic = this.mnemonic
    }
    return await chain.getAgent(agentOpts) as A
  }

  /** Create a `Connector` containing instances of `Chain` and `Agent`
    * as specified by the configuration and return a `Connector with them. */
  async getConnector <C extends Connector> ($C?: ConnectorClass<C>): Promise<C> {
    $C ??= Connector as ConnectorClass<C>
    // Create chain and agent
    const chain = await this.getChain()
    const agent = await this.getAgent(chain)
    if (agent.chain !== chain) throw new Error('Bug: agent.chain propagated incorrectly')
    // Create the Connector holding both and exposing them to commands.
    return new $C({ chain, agent, config: this }) as C
  }

  /** List all known chains. */
  listChains () {
    this.log.supportedChains()
    this.log.selectedChain(this.chainSelector as string)
  }

}

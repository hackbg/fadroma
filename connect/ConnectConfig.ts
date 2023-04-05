import Error from './ConnectError'
import Console from './ConnectConsole'
import Connector from './Connector'
import type { ConnectorClass } from './Connector'

import type { ChainRegistry, ChainId, Agent, AgentOpts } from '@fadroma/agent'
import { ChainMode, Chain } from '@fadroma/agent'
import { Config as ScrtConfig } from '@fadroma/scrt'

import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'

/** Connection configuration and Connector factory.
  * Factory pattern and consequent inversion of control
  * here imposed by the lack of `await new` */
export default class ConnectConfig extends Config {

  constructor (
    options: Partial<ConnectConfig> = {},
    environment?: Environment
  ) {
    super(options, environment)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
    this.scrt = new ScrtConfig(options?.scrt, environment)
  }

  log = new Console('@fadroma/connect')

  /** Secret Network configuration. */
  scrt: ScrtConfig

  /** Name of chain to use. */
  chainSelector?: keyof ChainRegistry = this.getString('FADROMA_CHAIN',
    ()=>'Mocknet_CW1')

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
  get chainId (): ChainId|null {
    const chainIds = {
      Mocknet_CW0: 'mocknet-cw0',
      Mocknet_CW1: 'mocknet-cw1',
      ScrtDevnet:   'fadroma-devnet',
      ScrtTestnet:  ScrtConfig.defaultTestnetChainId,
      ScrtMainnet:  ScrtConfig.defaultMainnetChainId,
    }
    return chainIds[this.chainSelector as keyof typeof chainIds] || null
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
  getChain <C extends Chain> (
    getChain: keyof ChainRegistry|ChainRegistry[keyof ChainRegistry]|undefined = this.chainSelector
  ): C {
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
    return getChain(this) as C // create Chain object
  }

  getAgent <A extends Agent> (chain?: Chain): A {
    chain ??= this.getChain()
    // Create the Agent instance as identified by the configuration.
    let agentOpts: AgentOpts = { chain }
    if (chain.isDevnet) {
      // On devnet, agent can be created from genesis account
      agentOpts.name = this.devnetAgentName
    } else {
      // Otherwise it's created from mnemonic
      agentOpts.mnemonic = this.mnemonic
    }
    return chain.getAgent(agentOpts) as A
  }

  /** Create a `Connector` containing instances of `Chain` and `Agent`
    * as specified by the configuration and return a `Connector with them. */
  async getConnector <C extends Connector> ($C?: ConnectorClass<C>): Promise<C> {
    $C ??= Connector as ConnectorClass<C>
    // Create chain and agent
    const chain = this.getChain()
    const agent = this.getAgent(chain)
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

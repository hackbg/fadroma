import type { Env } from '@hackbg/conf'
import { EnvConfig } from '@hackbg/conf'
import { Chain } from '@fadroma/core'
import type { Agent, AgentOpts, ChainId, ChainRegistry } from '@fadroma/core'
import { Scrt } from '@fadroma/scrt'
import { DevnetConfig } from '@fadroma/devnet'
import { ConnectError as Error } from './connect-events'
import type { Connector, ConnectorClass } from './connector'

/** Connection configuration and Connector factory.
  * Factory pattern and consequent inversion of control
  * here imposed by the lack of `await new` */
export class ConnectConfig extends EnvConfig {

  constructor (
    defaults: Partial<ConnectConfig> = {},
    readonly env: Env    = {},
    readonly cwd: string = '',
  ) {
    super(env, cwd)
    this.override(defaults)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
  }

  /** Name of chain to use. */
  chain?: keyof ChainRegistry = this.getString('FADROMA_CHAIN', ()=>undefined)

  /** Get a chain ID corresponding to the value of `this.chain`.
    * (Used by subclasses to include chain ID in paths.) */
  get chainId (): ChainId {
    const chainIds = {
      Mocknet_CW0: 'mocknet-cw0',
      Mocknet_CW1: 'mocknet-cw1',
      ScrtMainnet:  Scrt.defaultMainnetChainId,
      ScrtTestnet:  Scrt.defaultTestnetChainId,
      ScrtDevnet:   'fadroma-devnet',
    }
    if (!this.chain) throw new Error.NoChainSelected(chainIds)
    const result = chainIds[this.chain as keyof typeof chainIds]
    if (!result) throw new Error.UnknownChainSelected(this.chain, chainIds)
    return result
  }

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

  // Create the Chain instance specified by the configuration.
  async getChain <C extends Chain> (
    getChain?: keyof ChainRegistry|ChainRegistry[keyof ChainRegistry]
  ): Promise<C> {
    if (!getChain) { // default to configured
      getChain = this.chain
      if (!getChain) throw new Error.NoChain()
    }
    if (typeof getChain === 'string') { // allow name to be passed
      getChain = Chain.variants[getChain]
    }
    if (!getChain) { // if still unspecified, throw
      throw new Error.UnknownChainSelected(this.chain, Chain.variants)
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
    $C ??= (await import('./connector')).Connector as ConnectorClass<C>
    // Create chain and agent
    const chain = await this.getChain()
    const agent = await this.getAgent(chain)
    if (agent.chain !== chain) throw new Error('Bug: agent.chain propagated incorrectly')
    // Create the Connector holding both and exposing them to commands.
    return new $C({ chain, agent, config: this }) as C
  }

}


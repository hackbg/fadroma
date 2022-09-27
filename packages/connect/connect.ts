import { CustomConsole, bold } from '@hackbg/konzola'
import * as Komandi  from '@hackbg/komandi'
import { EnvConfig } from '@hackbg/konfizi'
import type { Env }  from '@hackbg/konfizi'

import {
  Agent, AgentOpts,
  Class,
  Chain, ChainClass, ChainId, ChainOpts, ChainRegistry,
  ClientConsole, ClientError,
  Deployment,
} from '@fadroma/client'
import { Devnet, DevnetConfig, defineDevnet } from '@fadroma/devnet'
import { Scrt, ScrtGrpc } from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { Mocknet } from '@fadroma/mocknet'

import { log, ConnectConsole, ConnectError } from './connect-events'

import { strictEqual } from 'node:assert'

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Mocknet.
  // TODO switch this out and give each chain implementation its own Mocknet subclass
  // (as CW1.0 contract env is different)
  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,
  // Support for current Secret Network
  ...ScrtGrpc.Chains,
  ScrtGrpcDevnet:  defineDevnet(ScrtGrpc,  'scrt_1.4'),
  // Support for Secret Network legacy amino API
  ...ScrtAmino.Chains,
  ScrtAminoDevnet: defineDevnet(ScrtAmino, 'scrt_1.2'),
})

/** Connection configuration and Connector factory.
  * Factory pattern and consequent inversion of control
  * here imposed by the lack of `await new` */
export class ConnectConfig extends EnvConfig {
  constructor (
    readonly env: Env    = {},
    readonly cwd: string = '',
    defaults: Partial<ConnectConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
  }

  /** Name of chain to use. */
  chain?: keyof ChainRegistry
    = this.getString('FADROMA_CHAIN',   ()=> undefined)

  /** Get a chain ID corresponding to the value of `this.chain`.
    * (Used by subclasses to include chain ID in paths.) */
  get chainId (): ChainId {
    const chainIds = {
      Mocknet:          'mocknet',
      ScrtGrpcMainnet:  Scrt.defaultMainnetChainId,
      ScrtGrpcTestnet:  Scrt.defaultTestnetChainId,
      ScrtGrpcDevnet:   'fadroma-devnet',
      ScrtAminoMainnet: Scrt.defaultMainnetChainId,
      ScrtAminoTestnet: Scrt.defaultTestnetChainId,
      ScrtAminoDevnet:  'fadroma-devnet',
    }
    if (!this.chain) throw new ConnectError.NoChainSelected(chainIds)
    const result = chainIds[this.chain as keyof typeof chainIds]
    if (!result) throw new ConnectError.UnknownChainSelected(chainIds, this.chain)
    return result
  }

  /** Secret Network configuration for gRPC API */
  scrtGrpc  = new ScrtGrpc.Config(this.env, this.cwd)

  /** Secret Network configuration for legacy Amino API */
  scrtAmino = new ScrtAmino.Config(this.env, this.cwd)

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
      if (!getChain) throw new ClientError.NoChain()
    }
    if (typeof getChain === 'string') { // allow name to be passed
      getChain = Chain.variants[getChain]
    }
    if (!getChain) { // if still unspecified, throw
      throw new ConnectError.UnknownChainSelected(this.chain, Chain.variants)
    }
    return await Promise.resolve(getChain(this)) as C // create Chain object
  }

  async getAgent <A extends Agent> (chain: Chain): Promise<A> {
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
  async getConnector <C extends Connector> (
    $C: ConnectorClass<C> = Connector as ConnectorClass<C>
  ): Promise<C> {
    // Create chain and agent
    const chain = await this.getChain()
    const agent = await this.getAgent(chain)
    strictEqual(agent.chain, chain, 'agent.chain propagated incorrectly')
    // Create the Connector holding both and exposing them to commands.
    return new $C({ agent, config: this }) as C
  }
}

/** Constructor for a subclass of Connector that
  * maintains the original constructor signature. */
export interface ConnectorClass<C extends Connector> extends Class<C, [
  Partial<Connector>
]>{}

/** A Deployment with associated Agent and awareness of other chains. */
export class Connector extends Deployment {
  constructor (options: Partial<Connector> = { config: new ConnectConfig() }) {
    super(options)
    this.config = new ConnectConfig(this.env, this.cwd, options?.config)
  }
  /** Logger */
  log = log
  /** Configuration. */
  config: ConnectConfig
  /** List all known chains. */
  chains = this.command('chains', 'print a list of all known chains', async () => {
    this.log.supportedChains()
    this.log.selectedChain(this.config.chain)
  })
}

export async function connect (
  config: Partial<ConnectConfig> = new ConnectConfig()
): Promise<Connector> {
  config = new ConnectConfig(undefined, undefined, config)
  return await (config as ConnectConfig).getConnector()
}

export { ConnectConsole, ConnectError }

export { Mocknet, ScrtGrpc, ScrtAmino, Devnet }

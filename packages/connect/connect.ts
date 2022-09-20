import { CustomConsole, bold } from '@hackbg/konzola'
import * as Komandi  from '@hackbg/komandi'
import { EnvConfig } from '@hackbg/konfizi'
import type { Env }  from '@hackbg/konfizi'

import {
  Agent, AgentOpts, Chain, ChainId, ChainOpts, ChainRegistry, ClientConsole, ClientError
} from '@fadroma/client'
import { Devnet, DevnetConfig, defineDevnet } from '@fadroma/devnet'
import { Scrt, ScrtGrpc } from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { Mocknet } from '@fadroma/mocknet'

export { Mocknet, ScrtGrpc, ScrtAmino, Devnet }

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

export async function connect (
  config: Partial<ConnectConfig> = new ConnectConfig()
): Promise<ConnectContext> {
  config = new ConnectConfig(undefined, undefined, config)
  return await config.connect!()
}

/** Connection and identity configuration from environment variables. */
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
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName: string
    = this.getString('FADROMA_AGENT',   ()=>
      this.getString('SCRT_AGENT_NAME', ()=> 'ADMIN'))
  /** Mnemonic to use for authentication. Hidden by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC',    ()=>
      this.getString('SCRT_AGENT_MNEMONIC', ()=> undefined))
  /** Devnet configuration. */
  devnet    = new DevnetConfig(this.env, this.cwd)
  /** Secret Network configuration for gRPC API */
  scrtGrpc  = new ScrtGrpc.Config(this.env, this.cwd)
  /** Secret Network configuration for legacy Amino API */
  scrtAmino = new ScrtAmino.Config(this.env, this.cwd)

  /** Get a chain ID corresponding to the value of `this.chain`.
    * Used to generated default paths for receipts in DeployConfig. */
  get chainId (): ChainId {
    if (!this.chain) throw new Error('No chain ID. Set FADROMA_CHAIN')
    const result = {
      Mocknet: 'mocknet',
      ScrtGrpcMainnet:  Scrt.defaultMainnetChainId,
      ScrtGrpcTestnet:  Scrt.defaultTestnetChainId,
      ScrtGrpcDevnet:   'fadroma-devnet',
      ScrtAminoMainnet: Scrt.defaultMainnetChainId,
      ScrtAminoTestnet: Scrt.defaultMainnetChainId,
      ScrtAminoDevnet:  'fadroma-devnet',
    }[this.chain]
    if (!result) throw new Error('No chain ID. Set FADROMA_CHAIN')
    return result
  }
  /** Create a `ConnectContext` containing instances of `Chain` and `Agent`
    * as specified by the configuration and return a `ConnectContext with them. */
  async connect (): Promise<ConnectContext> {
    // Create the Chain instance as specified by the configuration.
    const chains = Chain.variants
    let chain: Chain
    if (this.chain) {
      const getChain = chains[this.chain]
      if (!getChain) throw new Error(
        `Unknown chain ${this.chain}. Supported values are: ${Object.keys(chains).join(', ')}`
      )
      chain = await Promise.resolve(getChain(this))
    } else {
      throw new ClientError.NoChain()
    }
    // Create the Agent instance as identified by the configuration.
    let agentOpts: AgentOpts = { chain }
    if (chain?.isDevnet) {
      agentOpts.name = this.agentName
    } else {
      agentOpts.mnemonic = this.mnemonic
    }
    const agent = await chain?.getAgent(agentOpts) ?? null
    // Create the ConnectContext holding both and exposing them to commands.
    const context = new ConnectContext(this, chain!, agent)
    return context
  }
}

export class ConnectContext extends Komandi.CommandContext {
  constructor (
    config: Partial<ConnectConfig> = new ConnectConfig(),
    /** Chain to connect to. */
    public chain?: Chain|null,
    /** Agent to identify as. */
    public agent?: Agent|null,
  ) {
    super('connect', 'connection manager')
    this.config = new ConnectConfig(this.env, this.cwd, config)
  }
  config: ConnectConfig
  log = new ConnectConsole('Fadroma Connect')
  showChains = this.command('chains', 'print a list of all known chains', async () => {
    this.log.supportedChains()
    this.log.selectedChain(this.config.chain)
  })
}

export class ConnectConsole extends ClientConsole {
  name = 'Fadroma Connect'
  supportedChains = (supportedChains: object = Chain.variants) => {
    this.log()
    this.info('Known chain names:')
    for (const chain of Object.keys(supportedChains).sort()) {
      this.info(`  ${chain}`)
    }
  }
  noName = (chains: object) => {
    this.error('Pass a known chain name or set FADROMA_CHAIN env var.')
    this.supportedChains(chains)
    return 1
  }
  noDeploy = () => {
    this.warn('@fadroma/deploy not installed. Deployment system unavailable.')
    return null
  }
  selectedChain = (chain?: string) => {
    this.log()
    if (chain) {
      this.info('Selected chain:')
      this.info(`  ${chain}`)
    } else {
      this.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
  }
}

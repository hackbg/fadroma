import { CustomConsole, bold } from '@hackbg/konzola'
import * as Komandi  from '@hackbg/komandi'
import { EnvConfig } from '@hackbg/konfizi'
import type { Env }  from '@hackbg/konfizi'

import * as Fadroma  from '@fadroma/client'
import { Devnet }    from '@fadroma/devnet'
import { ScrtGrpc }  from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { Mocknet }   from '@fadroma/mocknet'

export { Mocknet, ScrtGrpc, ScrtAmino, Devnet }

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Fadroma.Chain.variants as Fadroma.ChainRegistry, {

  // Support for Mocknet.
  // TODO switch this out and give each chain implementation its own Mocknet subclass
  // (as CW1.0 contract env is different)
  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,

  // Support for current Secret Network
  ...ScrtGrpc.Chains,
  ScrtGrpcDevnet:  Devnet.define(ScrtGrpc,  'scrt_1.3' /** TODO use image name directly here */),

  // Support for Secret Network legacy amino API
  ...ScrtAmino.Chains,
  ScrtAminoDevnet: Devnet.define(ScrtAmino, 'scrt_1.2'),

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
  chains = Fadroma.Chain.variants
  /** Name of chain to use. */
  chain?: keyof Fadroma.ChainRegistry
    = this.getString('FADROMA_CHAIN',   ()=> undefined)
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName: string
    = this.getString('FADROMA_AGENT',   ()=>
      this.getString('SCRT_AGENT_NAME', ()=> 'ADMIN'))
  /** Mnemonic to use for authentication. Hidden by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC',    ()=>
      this.getString('SCRT_AGENT_MNEMONIC', ()=> undefined))

  async connect (): Promise<ConnectContext> {
    const chains = Fadroma.Chain.variants
    let chain: Fadroma.Chain|null = null
    if (this.chain) {
      const getChain = chains[this.chain]
      if (!getChain) throw new Error(
        `Unknown chain ${this.chain}. Supported values are: ${Object.keys(chains).join(', ')}`
      )
      chain = await Promise.resolve(getChain(this))
    }
    let agentOpts: Fadroma.AgentOpts = {}
    if (chain?.isDevnet) {
      agentOpts.name = this.agentName
    } else {
      agentOpts.mnemonic = this.mnemonic
    }
    const agent = await chain?.getAgent(agentOpts) ?? null
    const context = new ConnectContext(this, chain!, agent)
    return context
  }
}

export class ConnectContext extends Komandi.CommandContext {
  constructor (
    public config: Partial<ConnectConfig> = new ConnectConfig(),
    /** Chain to connect to. */
    public chain?: Fadroma.Chain|null,
    /** Agent to identify as. */
    public agent?: Fadroma.Agent|null,
  ) {
    super('connect', 'connection manager')
    this.config = new ConnectConfig(this.env, this.cwd, config)
  }
  log = new ConnectConsole('Fadroma Connect')
  showChains = this.command('chains', 'print a list of all known chains', async () => {
    this.log.supportedChains()
    this.log.selectedChain(this.config.chain)
  })
}

export class ConnectConsole extends Fadroma.ClientConsole {
  name = 'Fadroma Connect'
  supportedChains = (supportedChains: object = Fadroma.Chain.variants) => {
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

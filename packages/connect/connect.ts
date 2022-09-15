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
  config = new ConnectConfig(process.env, process.cwd(), config)
  const log = new ConnectConsole('Fadroma.connect')
  const { chains = {} } = config
  let chain: Fadroma.Chain|null = null
  let agent: Fadroma.AgentOpts = {}
  if (config.chain) {
    const getChain = chains[config.chain]
    if (!getChain) throw new Error(
      `Unknown chain ${config.chain}. Supported values are: ${Object.keys(chains).join(', ')}`
    )
    chain = await Promise.resolve(getChain(config))
  }
  if (chain?.isDevnet) {
    agent.name = config.agentName
  } else {
    agent.mnemonic = config.mnemonic
  }
  return new ConnectContext(
    config, chain!, chain ? await chain!.getAgent(agent) : undefined
  )
}

export class ConnectContext extends Fadroma.Deployment {
  constructor (
    config: Partial<ConnectConfig> = new ConnectConfig(),
    chain?: Fadroma.Chain,
    agent?: Fadroma.Agent,
  ) {
    super({ chain, agent })
    this.config = new ConnectConfig(this.env, this.cwd, config)
    this.command('chains', 'print a list of all known chains', this.showChains)
  }
  config: ConnectConfig
  showChains = async () => {
    const log = new ConnectConsole('Fadroma.ConnectCommands')
    log.supportedChains()
    log.selectedChain(this.config.chain)
  }
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
  }

  chains = Fadroma.Chain.variants

  /** Name of chain to use. */
  chain?: keyof Fadroma.ChainRegistry
    = this.getString('FADROMA_CHAIN',   ()=>undefined)

  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName: string
    = this.getString('FADROMA_AGENT',   ()=>
      this.getString('SCRT_AGENT_NAME', ()=>
                       'ADMIN'))

  /** Mnemonic to use for authentication. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC',    ()=>
      this.getString('SCRT_AGENT_MNEMONIC', ()=>
                       undefined))

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

import { CustomConsole, Console, bold } from '@hackbg/konzola'
import * as Komandi                     from '@hackbg/komandi'
import { EnvConfig }                    from '@hackbg/konfizi'

import * as Fadroma  from '@fadroma/client'
import { Devnet }    from '@fadroma/devnet'
import { Mocknet }   from '@fadroma/mocknet'

import { ScrtGrpc }  from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'

export class ConnectConfig extends EnvConfig {

  /** Path to root of project. */
  project:        string =
    this.getString('FADROMA_PROJECT',  ()=>this.cwd)

  /** Name of chain to use. */
  chain:          string | undefined =
    this.getString('FADROMA_CHAIN',    ()=>{
      const log = new ConnectConsole(console, 'Fadroma.ConnectConfig')
      process.exit(log.noName(chains))
    })

  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName:      string =
    this.getString('FADROMA_AGENT',    ()=>this.getString('SCRT_AGENT_NAME',     ()=>'ADMIN'))

  /** Mnemonic to use for authentication. */
  agentMnemonic?: string =
    this.getString('FADROMA_MNEMONIC', ()=>this.getString('SCRT_AGENT_MNEMONIC', ()=>undefined))

}

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Fadroma.Chain|Promise<Fadroma.Chain>>

export const chains: ChainRegistry = {
  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,
  // Support for current Secret Network
  ...ScrtGrpc.Chains,
  ScrtGrpcDevnet:  Devnet.define(ScrtGrpc,  'scrt_1.3'),
  // Support for Secret Network legacy amino API
  ...ScrtAmino.Chains,
  ScrtAminoDevnet: Devnet.define(ScrtAmino, 'scrt_1.2'),
}

export async function connect (
  config: ConnectConfig                          = new ConnectConfig(),
  chain:  Fadroma.Chain|keyof ChainRegistry|null = config.chain as keyof ChainRegistry,
  agent?: Fadroma.Agent|Fadroma.AgentOpts|string
): Promise<ConnectContext> {

  const log = new ConnectConsole(console, 'Fadroma.connect')

  if (!chain) {
    process.exit(log.noName(chains))
  }

  if (typeof chain === 'string') {
    if (!chains[chain]) {
      process.exit(log.noName(chains))
    }
    chain = await Promise.resolve(chains[chain](config))
  }

  if (typeof agent === 'string') {
    if (chain.isDevnet) {
      agent = { name: agent }
    } else {
      throw new Error('agent from string is only supported for devnet genesis accounts')
    }
  } else if (agent && !(agent instanceof Fadroma.Agent)) {
    agent.mnemonic = config.agentMnemonic
  }

  return new ConnectContext(config, chain, await chain.getAgent(agent))

}

/** The known chains. */
export class ConnectContext extends Komandi.Context {

  constructor (
    config: ConnectConfig,
    /** The selected blockhain to connect to. */
    public chain?: Fadroma.Chain,
    /** The selected agent to operate as. */
    public agent?: Fadroma.Agent
  ) {
    super()
    this.config = config ?? new ConnectConfig(this.env, this.cwd)
  }

  config: ConnectConfig

  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean { return this.chain?.devMode ?? false }

  /** = chain.isMainnet */
  get isMainnet (): boolean { return this.chain?.isMainnet ?? false }

  /** = chain.isTestnet */
  get isTestnet (): boolean { return this.chain?.isTestnet ?? false }

  /** = chain.isDevnet */
  get isDevnet  (): boolean { return this.chain?.isDevnet ?? false }

  /** = chain.isMocknet */
  get isMocknet (): boolean { return this.chain?.isMocknet ?? false }

}

/** Commands for @fadroma/connect cli */
export default class ConnectCommands extends Komandi.Commands<ConnectContext> {

  constructor (name: string = 'connect', before = [], after = []) {
    super(name, before, after)
    this.command('chains', 'print a list of all known chains', this.chains)
  }

  chains = async () => {
    const log = new ConnectConsole(console, 'Fadroma.ConnectCommands')
    log.supportedChains(chains)
    log.selectedChain((await connect()).config.chain)
  }

}

export class ConnectConsole extends CustomConsole {

  name = 'Fadroma Connect'

  supportedChains = (supportedChains: object) => {
    this.log()
    this.info('Known chain names:')
    for (const chain of Object.keys(supportedChains).sort()) {
      this.info(`  ${chain}`)
    }
  }

  noName = (chains: object) => {
    this.error('Fadroma: pass a known chain name or set FADROMA_CHAIN env var.')
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

  chainStatus = ({ chain, deployments }: {
    chain?: Fadroma.Chain,
    deployments?: { active?: { prefix: string }, list (): string[] }
  }) => {
    if (!chain) {
      this.info('│ No active chain.')
    } else {
      this.info('│ Chain type: ', bold(chain.constructor.name))
      this.info('│ Chain mode: ', bold(chain.mode))
      this.info('│ Chain ID:   ', bold(chain.id))
      this.info('│ Chain URL:  ', bold(chain.url.toString()))
      this.info('│ Deployments:', bold(String(deployments?.list().length)))
      if (deployments?.active) {
        this.info('│ Deployment: ', bold(String(deployments?.active?.prefix)))
      } else {
        this.info('│ No active deployment.')
      }
    }
  }

}

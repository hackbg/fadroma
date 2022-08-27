import { CustomConsole, Console, bold } from '@hackbg/konzola'
import { Commands, CommandContext }     from '@hackbg/komandi'
import { EnvConfig }                    from '@hackbg/konfizi'

import * as Fadroma  from '@fadroma/client'
import { Devnet }    from '@fadroma/devnet'
import { Mocknet }   from '@fadroma/mocknet'

import { ScrtGrpc }  from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'

export class ConnectConsole extends CustomConsole {

  name = 'Fadroma Connect'

  knownChains (knownChains: object) {
    this.log()
    this.info('Known chain names:')
    for (const chain of Object.keys(knownChains).sort()) {
      this.info(`  ${chain}`)
    }
  }

  noName (chains: object) {
    this.error('Fadroma: pass a known chain name or set FADROMA_CHAIN env var.')
    this.knownChains(chains)
  }

  noDeploy () {
    this.warn('@fadroma/deploy not installed. Deployment system unavailable.')
    return null
  }

  selectedChain ({ chain }: ConnectConfig) {
    this.log()
    if (chain) {
      this.info('Selected chain:')
      this.info(`  ${chain}`)
    } else {
      this.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
  }

  chainStatus ({ chain, deployments }: ConnectContext) {
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

export const log = new ConnectConsole(console)

export class ConnectConfig extends EnvConfig {

  /** Path to root of project. */
  project: string =
    this.getStr('FADROMA_PROJECT', ()=>this.cwd)

  /** Name of chain to use. */
  chain:   string | null =
    this.getStr('FADROMA_CHAIN')

  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName:     string =
    this.getStr('FADROMA_AGENT',    ()=>this.getStr('SCRT_AGENT_NAME',     ()=>'ADMIN'))

  /** Mnemonic to use for authentication. */
  agentMnemonic: string|null =
    this.getStr('FADROMA_MNEMONIC', ()=>this.getStr('SCRT_AGENT_MNEMONIC', ()=>null))

}

/** A collection of functions that return Chain instances. */
export type Chains = Record<string, (config: any)=>Fadroma.Chain|Promise<Fadroma.Chain>>

/** The known chains. */
export const knownChains: Chains = {

  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,

  // Support for current Secret Network
  ...ScrtGrpc.Chains,
  ScrtGrpcDevnet:  Devnet.define(ScrtGrpc,  'scrt_1.3'),

  // Support for Secret Network legacy amino API
  ...ScrtAmino.Chains,
  ScrtAminoDevnet: Devnet.define(ScrtAmino, 'scrt_1.2'),

}

/** Add a Chain and its Deployments to the Context. */
export async function connect (
  context: CommandContext & Partial<{ config: ConnectConfig, chains: Chains }>,
): Promise<ConnectContext> {

  const chains = context.chains ?? knownChains

  const config = { ...context.config ?? {}, ...new ConnectConfig() }

  const id     = config.chain

  // Check that a valid id is passed
  if (!id || !chains[id]) {
    new ConnectConsole(console).noName(chains)
    process.exit(1)
  }

  // Return chain and deployments handle
  const chain = await context.chains![id](context.config)

  // Get agent TODO optional
  const agentOpts: Fadroma.AgentOpts = { name: undefined }
  if (chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = config.agentName
  } else {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = config.agentMnemonic!
  }
  const agent = await chain.getAgent(agentOpts)

  return {
    ...context,
    config,
    chain,
    agent,
    devMode:   chain.isDevnet || chain.isMocknet,
    isDevnet:  chain.isDevnet,
    isMocknet: chain.isMocknet,
    isTestnet: chain.isTestnet,
    isMainnet: chain.isMainnet,
    deployments: await import('@fadroma/deploy')
      .then(({Deployments})=>Deployments.fromConfig(chain.id, config.project))
      .catch(new ConnectConsole(console).noDeploy)
  }
}

export interface ConnectContext extends CommandContext {
  config?:     Partial<ConnectConfig>
  /** Known blockchains and connection methods. */
  chains?:     Chains
  /** The selected blockhain to connect to. */
  chain:       Fadroma.Chain
  /** True if the chain is a devnet or mocknet */
  devMode:     boolean
  /** = chain.isMainnet */
  isMainnet:   boolean
  /** = chain.isTestnet */
  isTestnet:   boolean
  /** = chain.isDevnet */
  isDevnet:    boolean
  /** = chain.isMocknet */
  isMocknet:   boolean
  /** Collections of interlinked contracts on the selected chain. */
  deployments: import('@fadroma/deploy').Deployments|null
  /** Default identity to use when operating on the chain. */
  agent:       Fadroma.Agent
}

/** Commands for @fadroma/connect cli */
export default class ConnectCommands extends Commands<CommandContext> {

  constructor (name: string = 'connect', before = [], after = []) {
    super(name, [connect, ...before], after)
    this.command('chains', 'print a list of all known chains', this.chains)
  }

  chains = () => {
    log.knownChains(knownChains)
    log.selectedChain(new ConnectConfig())
  }

}

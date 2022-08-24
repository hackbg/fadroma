#!/usr/bin/env ganesha-node

import { Console, bold }  from '@hackbg/konzola'
import { CommandContext } from '@hackbg/komandi'
import EnvConfig          from '@hackbg/konfizi'

import * as Fadroma  from '@fadroma/client'
import Devnet        from '@fadroma/devnet'
import Mocknet       from '@fadroma/mocknet'

import { ScrtGrpc }  from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'

const console = Console('Fadroma Connect')

/// # CHAINS //////////////////////////////////////////////////////////////////////////////////////

export type Chains = Record<string, (config: any)=>Fadroma.Chain|Promise<Fadroma.Chain>>

export const knownChains: Chains = {

  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,

  // Support for current Secret Network
  ...ScrtGrpc.Chains,
  ScrtGrpcDevnet:  Devnet.define(ScrtGrpc,  'scrt_1.3'),

  // Support for Secret Network legacy amino API
  ...ScrtAmino.Chains,
  ScrtAminoDevnet: Devnet.define(ScrtAmino, 'scrt_1.2'),

}

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

export interface ConnectContext extends CommandContext {
  config?:     ConnectConfig
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

/** Add a Chain and its Deployments to the Context. */
export async function getConnectContext (
  context: CommandContext & Partial<{ config: ChainConfig, chains: Chains }>,
): Promise<ConnectContext> {

  context.chains ??= knownChains
  const config = { ...new ConnectConfig(), ...context.config ?? {} }
  const name = config.chain

  // Check that a valid name is passed
  if (!name || !context.chains![name]) {
    new ConnectReporter(console).noName(context.chains!)
    process.exit(1)
  }

  // Return chain and deployments handle
  const chain = await context.chains![name](config)
  return {
    ...context,
    config,
    chain,
    devMode:   chain.isDevnet || chain.isMocknet,
    isDevnet:  chain.isDevnet,
    isMocknet: chain.isMocknet,
    isTestnet: chain.isTestnet,
    isMainnet: chain.isMainnet,
    deployments: await import('@fadroma/deploy')
      .then(({Deployments})=>Deployments.fromConfig(chain.id, config.project))
      .catch(new ConnectReporter(console).noDeploy)
  }
}

/** Adds an Agent to the Context. */
export async function getAgentContext (context: ChainContext): Promise<AgentContext> {
  const config = { ...context.config ?? {}, ...new AgentConfig() }
  if (!context.chain) context = {
    config: context.config,
    ...context,
    ...await getChainContext(context)
  }
  const agentOpts: AgentOpts = { name: undefined }
  if (context.chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = config.agentName
  } else {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = config.agentMnemonic!
  }
  const agent = await context.chain.getAgent(agentOpts)
  return {
    ...context,
    config: { ...context.config||{}, ...config },
    agent,
  }
}

export class ConnectReporter {

  constructor (console: Partial<Console> = {}) {
    this.log   = console.log?.bind(console)   ?? this.log
    this.info  = console.info?.bind(console)  ?? this.info
    this.warn  = console.warn?.bind(console)  ?? this.warn
    this.error = console.error?.bind(console) ?? this.error
  }

  log   = (...args: any[]) => {}
  info  = (...args: any[]) => {}
  warn  = (...args: any[]) => {}
  error = (...args: any[]) => {}

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

  selectedChain ({ chain }: ChainConfig) {
    this.log()
    if (chain) {
      this.info('Selected chain:')
      this.info(`  ${chain}`)
    } else {
      this.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
  }

  chainStatus ({ chain, deployments }: ChainContext) {
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

import {fileURLToPath} from 'url'

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const print = new ConnectReporter(console)
  print.knownChains(knownChains)
  print.selectedChain(new ChainConfig())
}

#!/usr/bin/env ganesha-node

import { Chain, ChainMode, Agent, AgentOpts } from '@fadroma/client'
import { Scrt, ScrtGrpc                     } from '@fadroma/scrt'
import { ScrtAmino                          } from '@fadroma/scrt-amino'
import { DevnetKind, getDevnet              } from '@fadroma/devnet'
import { Mocknet                            } from '@fadroma/mocknet'
import { Console, bold             } from '@hackbg/konzola'
import { CommandContext, envConfig } from '@hackbg/komandi'

const console = Console('Fadroma Connect')

/// # CHAINS //////////////////////////////////////////////////////////////////////////////////////

/** Get chain settings from process runtime environment. */
export const getChainConfig = envConfig(({ Str, Bool }, cwd): ChainConfig => ({
  project: Str('FADROMA_PROJECT',  ()=>cwd) as string,
  chain:   Str('FADROMA_CHAIN',    ()=>null),
}))
/** Chain settings. */
export interface ChainConfig {
  /** Path to root of project. */
  project:  string
  /** Name of chain to use. */
  chain:    string|null
}
export type Chains = Record<string, (config: any)=>Chain|Promise<Chain>>
/** Add a Chain and its Deployments to the Context. */
export async function getChainContext (
  context: CommandContext & Partial<{ config: ChainConfig, chains: Chains }>,
): Promise<ChainContext> {
  //@ts-ignore
  context.chains ??= knownChains
  const config = { ...getChainConfig(), ...context.config ?? {} }
  const name = config.chain
  // Check that a valid name is passed
  if (!name || !context.chains![name]) {
    ConnectLogger(console).noName(context.chains!)
    process.exit(1)
  }
  // Return chain and deployments handle
  const chain = await context.chains![name](config)
  return {
    ...context,
    config,
    chain,
    ...chainFlags(chain),
    deployments: await getDeploymentsForChain(chain, config.project)
  }
}
export const defineDevnetMode =
  (Chain: { new(...args:any[]): Chain }, version: DevnetKind) =>
    async <T> (config: T) => {
      const mode = ChainMode.Devnet
      const node = await getDevnet(version)
      const id   = node.chainId
      const url  = node.url.toString()
      return new Chain(id, { url, mode, node })
    }
export const knownChains = {
  Mocknet: async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,
  ...ScrtGrpc.Chains,  ScrtGrpcDevnet:  defineDevnetMode(ScrtGrpc,  'scrt_1.3'),
  ...ScrtAmino.Chains, ScrtAminoDevnet: defineDevnetMode(ScrtAmino, 'scrt_1.2'),
}
export async function getDeploymentsForChain (chain: Chain, project: string) {
  //@ts-ignore
  return await import('@fadroma/deploy')
    .then(({Deployments})=>Deployments.fromConfig(chain.id, project))
    .catch(ConnectLogger(console).noDeploy)
}
export interface ChainContext extends CommandContext {
  config?:     ChainConfig
  /** Known blockchains and connection methods. */
  chains?:     Chains
  /** The selected blockhain to connect to. */
  chain:       Chain
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
}

/// # AGENTS //////////////////////////////////////////////////////////////////////////////////////

/** Get agent+chain settings from process runtime environment. */
export const getAgentConfig = envConfig(({ Str }, cwd, env): AgentConfig => ({
  ...getChainConfig(cwd, env),
  agentName:     Str('FADROMA_AGENT',    ()=>Str('SCRT_AGENT_NAME',  ()=>'ADMIN')) as string,
  agentMnemonic: Str('FADROMA_MNEMONIC', ()=>Str('SCRT_AGENT_MNEMONIC', ()=>null)) as string|null,
}))
/* Agent settings. */
export interface AgentConfig extends ChainConfig {
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName:     string
  /** Mnemonic to use for authentication. */
  agentMnemonic: string|null
}

/** Adds an Agent to the Context. */
export async function getAgentContext (context: ChainContext): Promise<AgentContext> {
  const config = { ...context.config ?? {}, ...getAgentConfig() }
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

export interface AgentContext extends ChainContext {
  /** Selected identity to use when operating on the chain. */
  agent:     Agent
}

export function chainFlags (chain: Chain) {
  return {
    devMode:     chain.isDevnet || chain.isMocknet,
    isDevnet:    chain.isDevnet,
    isMocknet:   chain.isMocknet,
    isTestnet:   chain.isTestnet,
    isMainnet:   chain.isMainnet,
  }
}

export const ConnectLogger = ({ log, info, warn, error }: Console) => ({
  noName (chains: object) {
    error('Fadroma: pass a known chain name or set FADROMA_CHAIN env var.')
    this.knownChains(chains)
  },
  noDeploy () {
    warn('@fadroma/deploy not installed. Deployment system unavailable.')
    return null
  },
  knownChains (knownChains: object) {
    log()
    info('Known chain names:')
    for (const chain of Object.keys(knownChains).sort()) {
      info(`  ${chain}`)
    }
  },
  selectedChain ({ chain }: ChainConfig) {
    log()
    if (chain) {
      info('Selected chain:')
      info(`  ${chain}`)
    } else {
      info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
  },
  chainStatus ({ chain, deployments }: ChainContext) {
    if (!chain) {
      info('│ No active chain.')
    } else {
      info('│ Chain type: ', bold(chain.constructor.name))
      info('│ Chain mode: ', bold(chain.mode))
      info('│ Chain ID:   ', bold(chain.id))
      info('│ Chain URL:  ', bold(chain.url.toString()))
      info('│ Deployments:', bold(String(deployments?.list().length)))
      if (deployments?.active) {
        info('│ Deployment: ', bold(String(deployments?.active?.prefix)))
      } else {
        info('│ No active deployment.')
      }
    }
  },
})

import {fileURLToPath} from 'url'

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  ConnectLogger(console).knownChains(knownChains)
  ConnectLogger(console).selectedChain(getChainConfig())
}

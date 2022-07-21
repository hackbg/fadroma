#!/usr/bin/env ganesha-node

import { Console, bold                      } from '@hackbg/konzola'
import { CommandContext, getFromEnv         } from '@hackbg/komandi'
import { Chain, ChainMode, Agent, AgentOpts } from '@fadroma/client'
import { ScrtGrpc  } from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { getDevnet } from '@fadroma/devnet'
import { Mocknet   } from '@fadroma/mocknet'

const console = Console('Fadroma Chains')

/** Getting builder settings from process runtime environment. */
export function getChainConfig (cwd = process.cwd(), env = process.env): ChainConfig {
  const { Str, Bool } = getFromEnv(env)
  return {
    project:       Str('FADROMA_PROJECT',  ()=>cwd),
    chain:         Str('FADROMA_CHAIN',    ()=>null),
    agentName:     Str('FADROMA_AGENT',    ()=>Str('SCRT_AGENT_NAME',     ()=>'ADMIN')),
    agentMnemonic: Str('FADROMA_MNEMONIC', ()=>Str('SCRT_AGENT_MNEMONIC', ()=>undefined))
  }
}

export interface ChainConfig {
  /** Path to root of project. */
  project:  string
  /** Name of chain to use. */
  chain:    string
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName:     string
  /** Mnemonic to use for authentication. */
  agentMnemonic: string
}

/** Add a Chain and its Deployments to the Context. */
export async function getChainContext (
  context: CommandContext & Partial<{ config: ChainConfig, chains: Chains }>,
): Promise<ChainContext> {
  context.chains ??= knownChains
  const config = { ...getChainConfig(), ...context.config ?? {} }
  const name = config.chain
  // Check that a valid name is passed
  if (!name || !context.chains[name]) {
    ChainMessages.NoName(context.chains)
    process.exit(1)
  }
  // Return chain and deployments handle
  const chain = await context.chains[name](config)
  return {
    ...context,
    config,
    chain,
    ...chainFlags(chain),
    deployments: await getDeploymentsForChain(chain, config.project)
  }
}

export type Chains = Partial<typeof knownChains>

export const knownChains = {
  async Mocknet (config): Promise<Mocknet> {
    return new Mocknet() as Mocknet
  },
  ...ScrtGrpc.Chains,
  async ScrtGrpcDevnet (config) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.3').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtGrpc(id, { url, mode, node })
  },
  ...ScrtAmino.Chains,
  async ScrtAminoDevnet (config) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.2').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtAmino(id, { url, mode, node })
  }
}



export async function getDeploymentsForChain (chain: Chain, project: string) {
  //@ts-ignore
  return await import('@fadroma/deploy')
    .then(({Deployments})=>Deployments.fromConfig(chain, project))
    .catch(ChainMessages.NoDeploy)
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

/** Adds an Agent to the Context. */
export async function getAgentContext (context: ChainContext): Promise<AgentContext> {
  const config = context.config ?? getChainConfig()
  if (!context.chain) context = {
    config: context.config,
    ...context,
    ...await getChainContext(context)
  }
  const agentOpts: AgentOpts = { name: undefined }
  if (context.chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = context.config.agentName
  } else {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = context.config.agentMnemonic
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

export function chainFlags (chain) {
  return {
    devMode:     chain.isDevnet || chain.isMocknet,
    isDevnet:    chain.isDevnet,
    isMocknet:   chain.isMocknet,
    isTestnet:   chain.isTestnet,
    isMainnet:   chain.isMainnet,
  }
}

export const ChainMessages = {
  NoName (chains) {
    console.error('Fadroma: pass a known chain name or set FADROMA_CHAIN env var.')
    ChainMessages.KnownChains(chains)
  },
  NoDeploy () {
    console.warn('@fadroma/deploy not installed. Deployment system unavailable.')
    return null
  },
  KnownChains (knownChains) {
    console.log()
    console.info('Known chain names:')
    for (const chain of Object.keys(knownChains).sort()) {
      console.info(`  ${chain}`)
    }
  },
  SelectedChain ({ chain }) {
    console.log()
    if (chain) {
      console.info('Selected chain:')
      console.info(`  ${chain}`)
    } else {
      console.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
  }
}

import {fileURLToPath} from 'url'

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  ChainMessages.KnownChains(knownChains)
  ChainMessages.SelectedChain(getChainConfig())
}

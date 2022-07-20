import { CommandContext } from '@hackbg/komandi'

import { Chain, ChainMode, Agent, AgentOpts } from '@fadroma/client'

import { ScrtGrpc  } from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { getDevnet } from '@fadroma/devnet'
import { Mocknet   } from '@fadroma/mocknet'

export const knownChains = {
  async 'Mocknet'          (config): Promise<Mocknet> {
    return new Mocknet() as Mocknet
  },
  async 'ScrtAminoMainnet' (config) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new ScrtAmino(id, { url, mode })
  },
  async 'ScrtAminoTestnet' (config) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new ScrtAmino(id, { url, mode })
  },
  async 'ScrtAminoDevnet'  (config) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.2').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtAmino(id, { url, mode, node })
  },
  async 'ScrtGrpcMainnet'  (config) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new ScrtGrpc(id, { url, mode })
  },
  async 'ScrtGrpcTestnet'  (config) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new ScrtGrpc(id, { url, mode })
  },
  async 'ScrtGrpcDevnet'   (config) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.3').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtGrpc(id, { url, mode, node })
  },
}

export type Chains = Partial<typeof knownChains>

export async function getChainContext (
  { config, chains },
  name = config?.project?.chain
): Promise<ChainContext> {
  config ??= {}
  chains ??= knownChains
  // Check that a valid name is passed
  if (!name || !chains[name]) {
    ChainMessages.NoName(chains)
    process.exit(1)
  }
  // Return chain and deployments handle
  const chain = await chains[name](config)
  return {
    chains,
    chain,
    ...chainFlags(chain),
    deployments: await getDeploymentsForChain(chain, config.project.root)
  }
}

export async function getDeploymentsForChain (chain: Chain, project: string) {
  return await import('@fadroma/deploy')
    .then(({Deployments})=>Deployments.fromConfig(chain, project))
    .catch(ChainMessages.NoDeploy)
}

export interface ChainContext extends CommandContext {
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

export async function getAgentContext ({ config, chain }): Promise<AgentContext> {
  config ??= {}
  const agentOpts: AgentOpts = { name: undefined }
  if (chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = 'ADMIN'
  } else if ((chain as any).isSecretNetwork) {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = config.scrt.agent.mnemonic
  }
  const agent = await chain.getAgent(agentOpts)
  return {
    agent,
    chain: agent.chain,
    ...chainFlags(agent.chain),
    deployments: await getDeploymentsForChain(chain, config.project.root)
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
    console.info('Known chain names:')
    for (const chain of Object.keys(chains).sort()) {
      console.info(`  ${chain}`)
    }
  },
  NoDeploy () {
    console.warn('@fadroma/deploy not installed. Deployment system unavailable.')
    return null
  }
}

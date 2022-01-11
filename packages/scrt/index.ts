export * from '@fadroma/ops'

export * from './ScrtAgentCLI'
export * from './ScrtAgentJS'
export * from './ScrtChainAPI'
export * from './ScrtChainNode'
export * from './ScrtContract'
export * from './ScrtGas'

export * from '@fadroma/scrt-1.0'
export * from '@fadroma/scrt-1.2'

import { open } from '@fadroma/tools'
export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url)
}

import { resolve, dirname, fileURLToPath } from '@fadroma/tools'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const buildScript = resolve(__dirname, 'ScrtBuild.sh')

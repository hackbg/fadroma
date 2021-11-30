export * from '@fadroma/ops'
export * from './ScrtContract'
export * from './ScrtChainAPI'
export * from './ScrtChainNode'
export * from './ScrtAgentJS'
export * from './ScrtAgentCLI'
export * from './ScrtGas'

export * from '@fadroma/scrt-1.0'
export * from '@fadroma/scrt-1.2'

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url)
}

export const chainIds = {
  mainnet: 'secret-4',
  testnet: 'pulsar-3',
}
export function connect (...args: Parameters<typeof Chain["connect"]>) {
  if (!args[0]) args[0] = {} as any
  return Chain.connect(...args)
} 
/** See https://docs.scrt.network/secret-network-documentation/development/resources-api-contract-addresses/connecting-to-the-network/mainnet-secret-4#api-endpoints */
export const mainnets = new Set([
  'https://lcd.mainnet.secretsaturn.net',
  'https://lcd.secret.express',
  'https://rpc.ankr.com/http/scrt_cosmos',
  'https://1rpc.io/scrt-lcd',
  'https://lcd-secret.whispernode.com',
  'https://secret-api.lavenderfive.com',
])
/** Connect to the Secret Network Mainnet. */
export function mainnet (options: Partial<Chain> = {}): Promise<Chain> {
  return Chain.connect({
    chainId: chainIds.mainnet, urls: [...mainnets], ...options||{}
  })
}
export const testnets = new Set([
  'https://api.pulsar.scrttestnet.com',
  'https://api.pulsar3.scrttestnet.com/'
])
/** Connect to the Secret Network Testnet. */
export function testnet (options: Partial<Chain> = {}): Promise<Chain> {
  return Chain.connect({
    chainId: chainIds.testnet, urls: [...testnets], ...options||{}
  })
}
/** Connect to a mock implementation of Secret Network. */
export async function mocknet (options: Partial<Chain> = {}): Promise<Chain> {
  const chain = await Chain.connect({ chainId: 'scrt-mocknet', })
  chain.connections = [new MocknetConnection({ chain })]
  return chain
}
export async function devnet (options): Promise<Chain> {
  let devnet
  try {
    devnet = await import('npm:@fadroma/devnet')
  } catch (e) {
    throw new Error('failed to import @fadroma/devnet. is it installed?')
  }
}

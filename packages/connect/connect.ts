import type { ChainRegistry } from '@fadroma/core'
import { Chain } from '@fadroma/core'
import { Devnet, defineDevnet } from '@fadroma/devnet'
import { Scrt } from '@fadroma/scrt'
import { Mocknet } from '@fadroma/mocknet'
import { Connector } from './connector'
import { ConnectConfig } from './connect-config'

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Mocknet
  Mocknet:     async (config: unknown): Promise<Mocknet> => new Mocknet() as Mocknet,
  // Support for Secret Network
  ScrtMainnet: Scrt.Mainnet,
  ScrtTestnet: Scrt.Testnet,
  ScrtDevnet:  defineDevnet(Scrt, 'scrt_1.4'),
})

export * from './connect-events'
export * from './connect-config'
export * from './connector'
export * as Scrt from '@fadroma/scrt'
export * as Mocknet from '@fadroma/mocknet'
export * as Devnet from '@fadroma/devnet'

export async function connect (
  config: Partial<ConnectConfig> = new ConnectConfig()
): Promise<Connector> {
  config = new ConnectConfig(undefined, undefined, config)
  return await (config as ConnectConfig).getConnector()
}

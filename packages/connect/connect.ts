import type { ChainRegistry } from '@fadroma/core'
import { Chain } from '@fadroma/core'
import { Devnet, defineDevnet } from '@fadroma/devnet'
import { Scrt } from '@fadroma/scrt'
import { Mocknet_CW0, Mocknet_CW1 } from '@fadroma/mocknet'
import { Connector } from './connector'
import { ConnectConfig } from './connect-config'

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Mocknet
  async Mocknet_CW0 (config: unknown): Promise<Mocknet_CW0> { return new Mocknet_CW0() },
  async Mocknet_CW1 (config: unknown): Promise<Mocknet_CW1> { return new Mocknet_CW1() },
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
  return await new ConnectConfig(config).getConnector()
}

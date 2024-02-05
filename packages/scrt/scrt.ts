/**
  Fadroma SCRT
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import type { ChainId } from '@fadroma/agent'
import { ScrtConnection, ScrtBatch } from './scrt-connection'
import { ScrtIdentity } from './scrt-identity'
import faucets from './scrt-faucets'

export {
  ScrtError   as Error,
  ScrtConsole as Console,
} from './scrt-base'
export {
  ScrtConnection as Connection,
  ScrtBatch      as Batch,
} from './scrt-connection'
export {
  ScrtIdentity         as Identity,
  ScrtSignerIdentity   as SignerIdentity,
  ScrtMnemonicIdentity as MnemonicIdentity,
} from './scrt-identity'
export { default as faucets } from './scrt-faucets'
export * as Mocknet from './scrt-mocknet'
export * as Snip20 from './snip-20'
export * as Snip24 from './snip-24'
export * as Snip721 from './snip-721'
export * as SecretJS from '@hackbg/secretjs-esm'

export const chainIds = {
  mainnet: 'secret-4',
  testnet: 'pulsar-3',
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
export function mainnet (options: Partial<ScrtConnection> = {}): ScrtConnection {
  return new ScrtConnection({
    chainId: chainIds.mainnet, url: pickRandom(mainnets), ...options||{}
  })
}

export const testnets = new Set([
  'https://api.pulsar.scrttestnet.com',
  'https://api.pulsar3.scrttestnet.com/'
])

/** Connect to the Secret Network Testnet. */
export function testnet (options: Partial<ScrtConnection> = {}): ScrtConnection {
  return new ScrtConnection({
    chainId: chainIds.testnet, url: pickRandom(testnets), ...options||{}
  })
}

const pickRandom = <T>(set: Set<T>): T => [...set][Math.floor(Math.random()*set.size)]

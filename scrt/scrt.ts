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

const pickRandom = <T>(set: Set<T>): T => [...set][Math.floor(Math.random()*set.size)]

export default class FadromaScrt {

  static Connection = ScrtConnection

  static Identity = ScrtIdentity

  static Batch = ScrtBatch

  /** Connect to the Secret Network Mainnet. */
  static mainnet = (options: Partial<ScrtConnection> = {}): ScrtConnection => {
    return new ScrtConnection({
      chainId: 'secret-4', url: pickRandom(this.mainnets), ...options||{}
    })
  }

  /** See https://docs.scrt.network/secret-network-documentation/development/resources-api-contract-addresses/connecting-to-the-network/mainnet-secret-4#api-endpoints */
  static mainnets = new Set([
    'https://lcd.mainnet.secretsaturn.net',
    'https://lcd.secret.express',
    'https://rpc.ankr.com/http/scrt_cosmos',
    'https://1rpc.io/scrt-lcd',
    'https://lcd-secret.whispernode.com',
    'https://secret-api.lavenderfive.com',
  ])

  /** Connect to the Secret Network Testnet. */
  static testnet = (options: Partial<ScrtConnection> = {}): ScrtConnection => {
    return new ScrtConnection({
      chainId: 'pulsar-3', url: pickRandom(this.testnets), ...options||{}
    })
  }

  static testnets = new Set([
    'https://api.pulsar.scrttestnet.com',
    'https://api.pulsar3.scrttestnet.com/'
  ])

  static faucets = faucets

  constructor () {
    throw new Error('static class')
  }
}

export * from './scrt-base'
export * from './scrt-connection'
export * from './scrt-identity'
export * as Mocknet from './scrt-mocknet'
export * as Snip20 from './snip-20'
export * as Snip24 from './snip-24'
export * as Snip721 from './snip-721'
export * as SecretJS from '@hackbg/secretjs-esm'

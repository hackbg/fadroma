/*
  Fadroma Cross-Chain Connector
  Copyright (C) 2022 Hack.bg

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

export * from './ConnectConsole'
export { default as ConnectConsole } from './ConnectConsole'

export * from './ConnectError'
export { default as ConnectError } from './ConnectError'

export * from './ConnectConfig'
export { default as ConnectConfig } from './ConnectConfig'

export * from './ConnectCommands'
export { default as ConnectCommands } from './ConnectCommands'

import * as Scrt from '@fadroma/scrt'
export * as Scrt from '@fadroma/scrt'

import { Mocknet, Mocknet_CW0, Mocknet_CW1 } from '@fadroma/agent'
export { Mocknet, Mocknet_CW0, Mocknet_CW1 } from '@fadroma/agent'

import ConnectConfig from './ConnectConfig'

import { Chain } from '@fadroma/agent'
import type { ChainRegistry } from '@fadroma/agent'

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Mocknet
  Mocknet_CW0 (config: unknown): Mocknet_CW0 {
    return new Mocknet_CW0()
  },
  Mocknet_CW1 (config: unknown): Mocknet_CW1 {
    return new Mocknet_CW1()
  },
  // Support for Secret Network
  ScrtMainnet: Scrt.Chain.Mainnet,
  ScrtTestnet: Scrt.Chain.Testnet,
  ScrtDevnet:  defineDevnet(Scrt.Chain, 'scrt_1.7'),
})

import type { Agent } from '@fadroma/agent'
export default function connect <A extends Agent> (
  config: Partial<ConnectConfig> = new ConnectConfig()
): A {
  return new ConnectConfig(config).getAgent()
}

import { ChainMode } from '@fadroma/agent'
export function defineDevnet (
  Chain: { new(...args:any[]): Chain },
  version: unknown
) {
  return async <T> (config: T) => {
    //@ts-ignore
    const { Config } = await import('@fadroma/ops')
    const mode = ChainMode.Devnet
    const conf = new Config()
    const node = await conf.getDevnet(version as Parameters<typeof conf.getDevnet>[0])
    const id   = node.chainId
    const url  = node.url.toString()
    return new Chain(id, { url, mode, node })
  }
}

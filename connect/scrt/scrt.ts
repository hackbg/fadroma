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

export * from './scrt-base'
export * from './scrt-chain'
export * as Snip20 from './snip-20'
export * as Snip24 from './snip-24'
export * as SecretJS from '@hackbg/secretjs-esm'

import { Agent } from './scrt-chain'
import { Batch } from './scrt-batch'
export { Batch }

export const mainnet = (...args: Parameters<typeof Agent.mainnet>) => Agent.mainnet(...args)
export const testnet = (...args: Parameters<typeof Agent.testnet>) => Agent.testnet(...args)
export const devnet  = (...args: Parameters<typeof Agent.devnet>)  => Agent.devnet(...args)
export const mocknet = (...args: Parameters<typeof Agent.mocknet>) => Agent.mocknet(...args)

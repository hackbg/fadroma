/*
  Fadroma Platform Package for Secret Network
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

export * from './scrt-base'
export * from './scrt-chain'
export * from './scrt-auth'
export * from './scrt-token'
export * as SecretJS from 'secretjs'

import { Chain } from './scrt-chain'
export const mainnet = Chain.mainnet
export const testnet = Chain.testnet
export const devnet  = Chain.devnet
export const mocknet = Chain.mocknet

/**
  Fadroma
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

import type { AgentClass } from '@fadroma/connect'
import { connectModes, CW, Scrt } from '@fadroma/connect'
import { Config } from './ops/config'

// Install devnets as selectable chains:
connectModes['ScrtDevnet'] = Scrt.Agent.devnet = (options: Partial<Scrt.Agent>|undefined) => {
  return new Config().devnet
    .getDevnet({ platform: 'scrt_1.9' })
    .getChain(Scrt.Agent, options)
}

connectModes['OKP4Devnet'] = CW.OKP4.Agent.devnet = (options: Partial<Scrt.Agent>|undefined) => {
  return new Config().devnet
    .getDevnet({ platform: 'okp4_5.0' })
    .getChain(CW.OKP4.Agent, options)
}

export * from '@fadroma/connect'
export * as Compilers from './ops/build'
export * as Stores from './ops/stores'
export * as Devnets from './ops/devnets'
export * as Tools from './ops/tools'
export * from './ops/config'
export * from './ops/project'
export { Config } from './ops/config'

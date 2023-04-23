/*
  Fadroma Deployment and Operations System
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

export * from './util'
export * from './devnet/index'
export * from './build/index'
export * from './upload/index'
export * from './deploy/index'

export * from './Project'
export { default as default } from './Project'

import type { ChainRegistry } from '@fadroma/agent'
import { Chain, ChainMode } from '@fadroma/agent'
import { Scrt } from '@fadroma/connect'
import { defineDevnet } from './devnet/index'
Object.assign(Chain.variants as ChainRegistry, {
  ScrtDevnet: Scrt.Chain.Devnet = defineDevnet(Scrt.Chain, 'scrt_1.8'),
})

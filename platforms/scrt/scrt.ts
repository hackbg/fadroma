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

import * as SecretJS from 'secretjs'
import { ScrtConfig } from './scrt-config'
import { Scrt       } from './scrt-chain'
import { ScrtAgent  } from './scrt-agent'
import { ScrtBundle } from './scrt-bundle'

export default Scrt

Object.assign(Scrt, {
  SecretJS: SecretJS,
  Config: ScrtConfig,
  Agent: Object.assign(ScrtAgent, {
    Bundle: ScrtBundle
  })
})

export { SecretJS }
export * from '@fadroma/core'
export * from './scrt-events'
export * from './scrt-config'
export * from './scrt-chain'
export * from './scrt-agent'
export * from './scrt-bundle'
export * from './scrt-vk'
export * from './scrt-permit'

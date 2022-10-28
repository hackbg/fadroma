/*
  Fadroma Platform Package for Secret Network
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

import type { AgentClass, BundleClass } from '@fadroma/client'
import { Scrt } from './scrt-chain'
import { ScrtAgent } from './scrt-agent'
import { ScrtBundle } from './scrt-bundle'
Scrt.Agent        = ScrtAgent  as unknown as AgentClass<ScrtAgent>
Scrt.Agent.Bundle = ScrtBundle as unknown as BundleClass<ScrtBundle>

/** Allow Scrt clients to be implemented with just `@fadroma/scrt` */
export * from '@fadroma/client'
export * from './scrt-events'
export * from './scrt-config'
export * from './scrt-chain'
export * from './scrt-agent'
export * from './scrt-bundle'
export * from './scrt-vk'
export * from './scrt-permit'

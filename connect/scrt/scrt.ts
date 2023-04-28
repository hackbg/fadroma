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

import Error from './ScrtError'
import Console from './ScrtConsole'
import Config from './ScrtConfig'
import * as SecretJS from 'secretjs'
import VKClient from './ScrtVK'

import { Chain, Agent, Bundle } from './ScrtChain'
Object.assign(Chain, { SecretJS, Agent: Object.assign(Agent, { Bundle }) })

export {
  Config,
  Error,
  Console,
  VKClient,
  SecretJS,
}

export * from './ScrtError'
export * from './ScrtConsole'
export * from './ScrtConfig'
export * from './ScrtChain'
export * from './ScrtPermit'
export * from './ScrtVK'

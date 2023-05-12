/**

  Fadroma: Core Agent Library
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

export * from './agent-base'
export * from './agent-chain'
export * from './agent-token'
export * from './agent-client'
export * from './agent-deploy'
export * from './agent-services'
export * as Mocknet from './agent-mocknet'

// This is here to prevent a circular dependency:
import { Chain } from './agent-chain'
import * as Mocknet from './agent-mocknet'
Chain.mocknet = (options: Partial<Mocknet.Chain> = {}): Mocknet.Chain => new Mocknet.Chain({
  id: 'mocknet',
  ...options
})

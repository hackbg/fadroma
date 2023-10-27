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

import { Batch } from './agent-batch'
import { StubChain, StubAgent } from './agent-stub'
import { Chain, Agent } from './agent-chain'

bindChainSupport(Chain, Agent, Batch)
bindChainSupport(StubChain, StubAgent, Batch)

/** Set the `Chain.Agent` and `Agent.Batch` static properties.
  * This is how a custom Chain implementation knows how to use
  * the corresponding Agent implementation, etc. */
export function bindChainSupport (Chain: Function, Agent: Function, Batch: Function) {
  Object.assign(Chain, { Agent: Object.assign(Agent, { Batch }) })
  return { Chain, Agent, Batch }
}

export * from './agent-base'
export * from './agent-chain'
export * from './agent-batch'
export * from './agent-stub'
export * from './agent-contract'
export * from './agent-token'

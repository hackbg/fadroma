/**

  Fadroma Agent
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

export * from './agent.browser'

// See note in connect.ts for what this does:
import { _$_HACK_$_ } from './chain'
import { LocalCompiledCode } from './program'
_$_HACK_$_.CompiledCode = LocalCompiledCode

export * as Program from './program'

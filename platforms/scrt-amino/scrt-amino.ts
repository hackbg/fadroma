/*
  Fadroma Platform Package for Secret Network with REST/Amino API
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

import * as SecretJS from 'secretjs' // this implementation uses secretjs 0.17
import * as Fadroma  from '@fadroma/scrt'
import { utf8, base64, bip39, bip39EN }  from '@hackbg/formati'
import { backOff } from 'exponential-backoff'
import { ScrtAminoError, ScrtAminoConsole } from './scrt-amino-events'
import { PatchedSigningCosmWasmClient_1_2 } from './scrt-amino-patch'

const log = new ScrtAminoConsole()

import { ScrtAminoConfig } from './scrt-amino-config'
import { ScrtAmino }       from './scrt-amino-chain'
import { ScrtAminoAgent }  from './scrt-amino-agent'
import { ScrtAminoBundle } from './scrt-amino-bundle'
ScrtAmino.Agent        = ScrtAminoAgent
ScrtAmino.Config       = ScrtAminoConfig
ScrtAmino.Agent.Bundle = ScrtAminoBundle

export * from '@fadroma/scrt'
export { SecretJS }
export * from './scrt-amino-events'
export * from './scrt-amino-config'
export * from './scrt-amino-chain'
export * from './scrt-amino-agent'
export * from './scrt-amino-bundle'

/**

  Fadroma
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

import * as Komandi   from '@hackbg/komandi'
import * as Build     from '@fadroma/build'
import * as Deploy    from '@fadroma/deploy'
import * as Devnet    from '@fadroma/devnet'
import * as Connect   from '@fadroma/connect'
import * as ScrtGrpc  from '@fadroma/scrt'
import * as ScrtAmino from '@fadroma/scrt-amino'

/** Complete environment configuration of Fadroma as flat namespace. */
export type FadromaConfig =
  & Build.BuilderConfig
  & Connect.ConnectConfig
  & Deploy.DeployConfig
  & Devnet.DevnetConfig
  & ScrtGrpc.ScrtGrpcConfig
  & ScrtAmino.ScrtAminoConfig

/** Get the combined Fadroma config for all modules from the runtime environment. */
export function getFadromaConfig (cwd: string, env = {}): FadromaConfig {
  return {
    ...new Build.BuilderConfig(env, cwd),
    ...new Connect.ConnectConfig(env, cwd),
    ...new Deploy.DeployConfig(env, cwd),
    ...new Devnet.DevnetConfig(env, cwd),
    ...ScrtGrpc.ScrtGrpc.getConfig(cwd, env),
    ...ScrtAmino.ScrtAmino.getConfig(cwd, env),
  }
}

/** Context for Fadroma commands. */
export type Context =
  & Komandi.CommandContext
  & Build.BuildContext
  & Deploy.DeployContext
  & { config: FadromaConfig }

// Reexport the entirety of the Fadroma suite.
export * from '@fadroma/build'
export * from '@fadroma/client'
export * from '@fadroma/connect'
export * from '@fadroma/deploy'
export * from '@fadroma/mocknet'
export * from '@fadroma/tokens'
//export * from '@fadroma/schema' // not updated yet

// Platform support:
export * from '@fadroma/scrt'
export { SecretJS } from '@fadroma/scrt'
export * from '@fadroma/scrt-amino'
export { SecretJS as SecretJSAmino } from '@fadroma/scrt-amino'

// Reexport some toolbox utilities:
export * from '@hackbg/komandi'
export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'

// There's apparently also a decimal in @iov/encoding?
// Gotta see if it's compatible.
export type { Decimal } from '@fadroma/client'

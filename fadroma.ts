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

import * as Komandi          from '@hackbg/komandi'
import * as FadromaBuild     from '@fadroma/build'
import * as FadromaDeploy    from '@fadroma/deploy'
import * as FadromaDevnet    from '@fadroma/devnet'
import * as FadromaConnect   from '@fadroma/connect'
import * as FadromaScrtGrpc  from '@fadroma/scrt'
import * as FadromaScrtAmino from '@fadroma/scrt-amino'

/** Complete environment configuration of Fadroma as flat namespace. */
export type FadromaConfig =
  & FadromaBuild.BuilderConfig
  & FadromaConnect.ChainConfig
  & FadromaDeploy.DeployConfig
  & FadromaDevnet.DevnetConfig
  & FadromaScrtGrpc.ScrtGrpcConfig
  & FadromaScrtAmino.ScrtAminoConfig

/** Get the combined Fadroma config for all modules from the runtime environment. */
export function getFadromaConfig (cwd: string, env = {}): FadromaConfig {
  return {
    ...FadromaBuild.getBuilderConfig(cwd, env),
    ...FadromaConnect.getChainConfig(cwd, env),
    ...FadromaDeploy.getDeployConfig(cwd, env),
    ...FadromaDevnet.getDevnetConfig(cwd, env),
    ...FadromaScrtGrpc.ScrtGrpc.getConfig(cwd, env),
    ...FadromaScrtAmino.ScrtAmino.getConfig(cwd, env),
  }
}

/** Context for Fadroma commands. */
export type Context =
  & Komandi.CommandContext
  & { config: FadromaConfig }
  & FadromaBuild.BuildContext
  & FadromaDeploy.DeployContext

// Reexport the entirety of the Fadroma suite.
export * from '@fadroma/build'
export * from '@fadroma/client'
export * from '@fadroma/connect'
export * from '@fadroma/deploy'
export * from '@fadroma/mocknet'
export * from '@fadroma/scrt'
export * from '@fadroma/scrt-amino'
export * from '@fadroma/tokens'
//export * from '@fadroma/schema' // not updated yet

// Reexport some toolbox utilities.
export * from '@hackbg/komandi'
export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'

// There's apparently also a decimal in @iov/encoding?
// Gotta see if it's compatible.
export type { Decimal } from '@fadroma/client'

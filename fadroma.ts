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

export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'

export * from '@fadroma/client'
export type { Decimal } from '@fadroma/client'

import * as Build     from '@fadroma/build'
export * as Build     from '@fadroma/build'

import * as Deploy    from '@fadroma/deploy'
export * as Deploy    from '@fadroma/deploy'

import * as Devnet    from '@fadroma/devnet'
export * as Devnet    from '@fadroma/devnet'

import * as Connect   from '@fadroma/connect'
export * as Connect   from '@fadroma/connect'

import * as ScrtGrpc  from '@fadroma/scrt'
export * as ScrtGrpc  from '@fadroma/scrt'

import * as ScrtAmino from '@fadroma/scrt-amino'
export * as ScrtAmino from '@fadroma/scrt-amino'

export * as Mocknet   from '@fadroma/mocknet'

export * as Tokens    from '@fadroma/tokens'

import * as Konfizi   from '@hackbg/konfizi'
import * as Komandi   from '@hackbg/komandi'

/** Complete environment configuration of all Fadroma subsystems. */
export class FadromaConfig extends Konfizi.EnvConfig {
  build     = new Build.BuilderConfig(this.env, this.cwd)
  connect   = new Connect.ConnectConfig(this.env, this.cwd)
  deploy    = new Deploy.DeployConfig(this.env, this.cwd)
  devnet    = new Devnet.DevnetConfig(this.env, this.cwd)
  scrtGrpc  = new ScrtGrpc.ScrtGrpcConfig(this.env, this.cwd)
  scrtAmino = new ScrtAmino.ScrtAminoConfig(this.env, this.cwd)
}

/** Context for Fadroma commands. */
export class FadromaContext extends Komandi.Context {
  config  = new FadromaConfig(this.env, this.cwd)
  build   = new Build.BuildContext(this.config.build)
  connect = new Connect.ConnectContext(this.config.connect)
  deploy  = new Deploy.DeployContext(this.config.deploy, this.connect, this.build)
}

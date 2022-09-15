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

import * as Konfizi   from '@hackbg/konfizi'
import * as Komandi   from '@hackbg/komandi'
import * as Konzola   from '@hackbg/konzola'
import * as Fadroma   from '@fadroma/client'
import * as Build     from '@fadroma/build'
import * as Connect   from '@fadroma/connect'
import * as Deploy    from '@fadroma/deploy'
import * as Devnet    from '@fadroma/devnet'

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Fadroma.Chain|Promise<Fadroma.Chain>>

/** Complete environment configuration of all Fadroma subsystems. */
export class Config extends Konfizi.EnvConfig {
  /** Path to root of project. Defaults to current working directory. */
  project: string = this.getString('FADROMA_PROJECT', ()=>this.cwd)
  build     = new Build.BuilderConfig(this.env, this.cwd)
  connect   = new Connect.ConnectConfig(this.env, this.cwd)
  deploy    = new Deploy.DeployConfig(this.env, this.cwd)
  devnet    = new Devnet.DevnetConfig(this.env, this.cwd)
  scrtGrpc  = new Connect.ScrtGrpc.Config(this.env, this.cwd)
  scrtAmino = new Connect.ScrtAmino.Config(this.env, this.cwd)
}

/** Context for Fadroma commands. */
export class Commands extends Komandi.CommandContext {

  static async run (argv: string[]) {
    return (await this.init()).run(argv)
  }

  static async init (name: string = 'Fadroma') {
    const config = new Config(process.env, process.cwd())
    const connection = await Connect.connect(config.connect)
    const { chain, agent } = connection
    if (!agent) new Deploy.DeployConsole('Fadroma').warnNoAgent()
    const deployments = chain ? Deploy.Deployments.init(chain.id, config.project) : null
    const build = new Build.BuildCommands({
      name: `${name} Build`, config: config.build
    })
    const deploy = await Deploy.DeployCommands.init(config.deploy, build)
    return new this(
      config,
      chain,
      agent,
      config.project,
      build,
      connection,
      deploy
    )
  }

  constructor (
    public config:   Config,
    /** The selected blockhain to connect to. */
    public chain?:   Fadroma.Chain,
    /** The selected agent to operate as. */
    public agent?:   Fadroma.Agent,
    public project?: string,
    public build?:   Build.BuildCommands,
    public connect?: Connect.ConnectContext,
    public deploy?:  Deploy.DeployCommands
  ) {
    super('Fadroma')
  }

}

export const Console = Fadroma.ClientConsole
export * from '@hackbg/konzola'
export * from '@hackbg/komandi'
export * from '@hackbg/konfizi'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'
export * from '@fadroma/client'
export type { Decimal } from '@fadroma/client'
export * from '@fadroma/build'
export * from '@fadroma/deploy'
export * from '@fadroma/devnet'
export * from '@fadroma/connect'
export * from '@fadroma/mocknet'
export * from '@fadroma/tokens'
export * as ScrtGrpc  from '@fadroma/scrt'
export * as ScrtAmino from '@fadroma/scrt-amino'
export { connect } from '@fadroma/connect'

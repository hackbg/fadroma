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

import { BuilderConfig, BuildContext } from '@fadroma/build'
import { ScrtGrpc, ScrtAmino } from '@fadroma/connect'
import { DeployConfig, DeployContext } from '@fadroma/deploy'
import { DevnetConfig } from '@fadroma/devnet'

import { Chain, Agent, Deployment, ClientConsole } from '@fadroma/client'

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Chain|Promise<Chain>>

/** Complete environment configuration of all Fadroma subsystems. */
export class Config extends DeployConfig {
  /** Path to root of project. Defaults to current working directory. */
  project: string = this.getString('FADROMA_PROJECT', ()=>this.cwd)
  build     = new BuilderConfig(this.env, this.cwd, { project: this.project })
  devnet    = new DevnetConfig(this.env, this.cwd)
  scrtGrpc  = new ScrtGrpc.Config(this.env, this.cwd)
  scrtAmino = new ScrtAmino.Config(this.env, this.cwd)
}

/** Context for Fadroma commands. */
export default class Fadroma extends DeployContext {

  static run (name: string = 'Fadroma') {
    const self = this
    return (argv: string[]) => self.init(name).then(context=>context.run(argv))
  }

  static async init (name: string = 'Fadroma') {
    const config = new Config(process.env, process.cwd())
    const { chain, agent, deployments, uploader } = await config.connect()
    const build = config.build.getBuildContext()
    return new this(
      name,
      config,
      chain,
      agent,
      config.project,
      build,
    )
  }

  constructor (
    /** Used by logger. */
    public name:     string,
    /** System configuration. */
    public config:   Config,
    /** The selected blockhain to connect to. */
    public chain?:   Chain|null,
    /** The selected agent to operate as. */
    public agent?:   Agent|null,
    public project?: string,
    public build?:   BuildContext,
  ) {
    super({ name })
    this.log.name = name
  }

  subsystem = <X extends Deployment>(
    name: string,
    info: string,
    ctor: { new (d: Deployment|null|undefined, ...args: unknown[]): X },
    ...args: unknown[]
  ): X => this.commands(name, info, new ctor(this.deployment, ...args)) as X

}

export const Console = ClientConsole
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

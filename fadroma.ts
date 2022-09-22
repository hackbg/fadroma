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

import { Chain, Agent, Deployment, ClientConsole, Builder, Uploader } from '@fadroma/client'
import { BuilderConfig, BuildContext } from '@fadroma/build'
import { DeployConfig, DeployContext } from '@fadroma/deploy'
import type { DeployStore } from '@fadroma/deploy'
import { DevnetConfig } from '@fadroma/devnet'
import { ScrtGrpc, ScrtAmino } from '@fadroma/connect'
import { TokenManager } from '@fadroma/tokens'

/** Configuration for the Fadroma environment. */
class FadromaConfig extends DeployConfig {
  build = new BuilderConfig(this.env, this.cwd, { project: this.project })
}

export { FadromaConfig as Config }

/** Context for Fadroma commands. */
export default class Fadroma extends DeployContext {
  /** @returns a function that runs a requested command. */
  static run (name: string = 'Fadroma'): AsyncEntrypoint {
    const self = this
    return (argv: string[]) => self.init(name).then(context=>context.run(argv))
  }
  /** Constructs a populated instance of the Fadroma context. */
  static async init (
    name:    string = 'Fadroma',
    options: Partial<FadromaConfig> = {}
  ): Promise<Fadroma> {
    const config = new FadromaConfig(process.env, process.cwd(), options)
    const { chain, agent, deployments, uploader } = await config.getDeployContext()
    return new this(name, config, chain, agent, deployments, uploader)
  }
  constructor (
    /** Used by logger. */
    public name:        string,
    /** Configuration. */
    config:             Partial<FadromaConfig> = new FadromaConfig(),
    /** Represents the blockchain to which we will connect. */
    public chain:       Chain|null             = null,
    /** Represents the identity which will perform operations on the chain. */
    public agent:       Agent|null             = null,
    /** Contains available deployments for the current chain. */
    public deployments: DeployStore|null       = null,
    /** Implements uploading and upload reuse. */
    public uploader:    Uploader|null          = null,
    /** Build context. */
    public build:       BuildContext|null      = null
  ) {
    super(config, chain, agent)
    this.log.name = name
    this.config = new FadromaConfig(this.env, this.cwd, config)
    this.build ??= this.config.build.getBuildContext()
    this.workspace = config.project
    this.tokens = this.commands('tokens', 'Fadroma Token Manager',
      new TokenManager(()=>this.deployment))
  }
  /** The current configuration. */
  config: FadromaConfig
  /** The currently configured builder, or null. */
  get builder (): Builder|null {
    return this.build?.builder ?? null
  }
  /** The workspace from which to build contracts.
    * Defaults to project root. */
  workspace?: string
  /** The token manager API. */
  tokens: TokenManager
}

/** Asynchronous function that takes an array of command arguments
  * and returns an unspecified value. */
export type AsyncEntrypoint = (argv: string[]) => Promise<unknown>

export const Console = ClientConsole
export * from '@hackbg/konzola'
export * from '@hackbg/komandi'
export * from '@hackbg/konfizi'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'
export * from '@fadroma/client'
export { override } from '@fadroma/client'
export type { Decimal, Overridable } from '@fadroma/client'
export * from '@fadroma/build'
export * from '@fadroma/deploy'
export * from '@fadroma/devnet'
export * from '@fadroma/connect'
export * from '@fadroma/mocknet'
export * from '@fadroma/tokens'
export * as ScrtGrpc  from '@fadroma/scrt'
export * as ScrtAmino from '@fadroma/scrt-amino'
export { connect } from '@fadroma/connect'

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
import type { DeployStore } from '@fadroma/client'
import { BuilderConfig } from '@fadroma/build'
import { DeployConfig, Deployer, DeployConsole } from '@fadroma/deploy'
import type { DeployerClass } from '@fadroma/deploy'
import { DevnetConfig } from '@fadroma/devnet'
import { ScrtGrpc, ScrtAmino } from '@fadroma/connect'
import { TokenManager } from '@fadroma/tokens'

import repl from 'node:repl'
import { createContext } from 'node:vm'

/** Context for Fadroma commands. */
export default class Fadroma extends Deployer {

  /** @returns a function that runs a requested command. */
  static run (projectName: string = 'Fadroma'): AsyncEntrypoint {
    const self = this
    return (argv: string[]) => self.init(projectName).then(context=>context.run(argv))
  }

  /** Constructs a populated instance of the Fadroma context. */
  static async init (
    projectName: string = 'Fadroma',
    options:     Partial<Config> = {}
  ): Promise<Fadroma> {
    const config = new Config(process.env, process.cwd(), options)
    return config.getDeployer(this as DeployerClass<Deployer>) as unknown as Fadroma
  }

  constructor (options: Partial<Fadroma> = { config: new Config() }) {
    super(options as Partial<Deployer>)
    this.log.name  = this.projectName
    this.config    = new Config(this.env, this.cwd, options.config)
    this.workspace = this.config.project
    this.builder ??= this.config?.build?.getBuilder()
    this.addCommand('repl',   'interact with this project from a Node.js REPL',
                    () => this.startREPL())
    this.addCommand('update', 'update the current deployment',
                    () => this.selectDeployment().then(()=>this.update()))
    this.addCommand('deploy', 'create a new deployment of this project',
                    () => this.deploy())
  }

  /** Override this to set your project name. */
  projectName: string = 'Fadroma'

  /** The current configuration. */
  config: Config

  /** The token manager API. */
  tokens: TokenManager = this.commands(
    'tokens', 'Fadroma Token Manager', new TokenManager(()=>this as Deployment)
  )

  token (symbol: string) {
    return this.tokens.deploy(symbol, {})
  }

  /** Override this to implement your pre-deploy procedure. */
  async deploy () {
    await this.createDeployment()
    await this.update()
  }

  /** Override this to implement your deploy/update procedure. */
  async update () {
    this.log.info('Fadroma#update: override this method with your deploy/update procedure.')
  }

  /** Start an interactive REPL. */
  async startREPL () {
    setTimeout(()=>Object.assign(
      repl.start({ prompt: '\nFadroma> ' }),
      { context: this.replContext() }
    ))
  }

  protected replContext () {
    return createContext(this)
  }

}

/** Configuration for the Fadroma environment. */
export class Config extends DeployConfig {
  build = new BuilderConfig(this.env, this.cwd, { project: this.project })
}

/** Default export of command module. */
export type AsyncEntrypoint = (argv: string[]) => Promise<unknown>

export class Console extends DeployConsole {
  constructor (name = 'Fadroma') { super(name) }
}

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

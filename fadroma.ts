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

import { Chain, Agent, Deployment, Class, ClientConsole, Builder, Uploader } from '@fadroma/core'
import type { DeployStore } from '@fadroma/core'
import { BuilderConfig } from '@fadroma/build'
import { DeployConfig, Deployer, DeployConsole, FSUploader } from '@fadroma/deploy'
import type { DeployerClass } from '@fadroma/deploy'
import { DevnetConfig } from '@fadroma/devnet'
import { Scrt } from '@fadroma/connect'
import { TokenManager } from '@fadroma/tokens'
import type { TokenOptions, Snip20 } from '@fadroma/tokens'

import repl from 'node:repl'
import { createContext } from 'node:vm'

export class Console extends DeployConsole {
  constructor (name = 'Fadroma') { super(name) }
}

/** Configuration for the Fadroma environment. */
export class Config extends DeployConfig {
  build = new BuilderConfig({ project: this.project }, this.env, this.cwd)
}

/** Context for Fadroma commands. */
export class Fadroma extends Deployer {

  /** Override this to set your project name. */
  projectName: string = 'Fadroma'

  /** The current configuration. */
  config: Config

  /** The token manager API. */
  tokens: TokenManager

  constructor (config: Partial<Config> = {}) {
    super({ config })
    this.log.label = this.projectName
    this.config = new Config(config, this.env, this.cwd)
    this.workspace = this.config.project
    this.builder ??= this.config?.build?.getBuilder()
    this.tokens = new TokenManager(this as Deployment)
    this
      .addCommands('tokens', 'manage token contracts',
                   this.tokens as any)
      .addCommand('repl',   'interact with this project from a Node.js REPL',
                  () => this.startREPL())
      .addCommand('update', 'update the current deployment',
                  () => this.selectDeployment().then(()=>this.update()))
      .addCommand('deploy', 'create a new deployment of this project',
                  () => this.deploy())
  }

  get ready () {
    const self = this
    const ready: Promise<typeof this> = (async function getReady (): Promise<typeof self> {
      self.agent    ??= await self.config.getAgent()
      self.chain    ??= await self.agent.chain
      self.uploader ??= await self.agent.getUploader(FSUploader)
      self.builder  ??= await self.config.build.getBuilder()
      return self
    })()
    Object.defineProperty(this, 'ready', { get () { return ready } })
    return ready
  }

  /** Override this to implement your pre-deploy procedure. */
  async deploy () {
    await this.createDeployment()
    await this.update()
  }

  /** Override this to implement your deploy/update procedure. */
  async update (overridden: boolean = false) {
    if (!overridden) {
      this.log.info('Fadroma#update: override this method with your deploy/update procedure.')
    }
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

/** Default export of command module. */
export type AsyncEntrypoint = (argv: string[]) => Promise<unknown>

export * from '@hackbg/logs'
export * from '@hackbg/cmds'
export * from '@hackbg/conf'
export * from '@hackbg/file'
export * from '@hackbg/4mat'
export * from '@fadroma/core'
export { override } from '@fadroma/core'
export type { Decimal, Overridable } from '@fadroma/core'
export * from '@fadroma/build'
export * from '@fadroma/deploy'
export * from '@fadroma/connect'
export * from '@fadroma/tokens'

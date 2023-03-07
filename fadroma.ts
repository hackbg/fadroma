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

import { CommandContext } from '@hackbg/cmds'

export class Console extends DeployConsole {
  constructor (name = 'Fadroma') {
    super(name)
  }
}

/** Configuration for the Fadroma environment. */
export class Config extends DeployConfig {
  build = new BuilderConfig({ project: this.project }, this.env, this.cwd)
}

/** Context for Fadroma commands. */
export class Fadroma extends Deployer {

  /** The current configuration. */
  config: Config

  /** The token manager, containing all tokens known to the project */
  tokens: TokenManager

  constructor (options: { config?: Partial<Config> } = {}) {
    super(options as any /* FIXME */)
    this.log.label = this.projectName
    this.config = (options.config instanceof Config)
      ? options.config
      : new Config(options.config, process.env, process.cwd())
    // Configure build context
    this.workspace = this.config.project
    this.builder ??= this.config?.build?.getBuilder()
    // Create token manager
    this.tokens = new TokenManager(this as Deployment)
    // Define commands
    //this.addCommands('tokens', 'manage token contracts', this.tokens as any)
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

}

import { BuildCommands } from '@fadroma/build'
import { ConnectCommands } from '@fadroma/connect'

import { projectWizard } from '@fadroma/project'
import $, { OpaqueDirectory } from '@hackbg/file'

export default class FadromaCommands extends CommandContext {
  constructor (
    readonly fadroma: Fadroma = new Fadroma()
  ) {
    super()
    this.addCommand('create', 'create a new project', projectWizard)
        //.addCommands('chain', 'manage chains and connections', new ChainCommands())
        //.addCommands('contract', 'manage contracts', new ContractCommands())
        //.addCommands('deployment', 'manage contracts', new DeploymentCommands())
        //.addCommands('token', 'manage token contracts', new TokensCommands())
  }
}

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

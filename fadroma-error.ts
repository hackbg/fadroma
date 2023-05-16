/**

  Fadroma: Error Types
  Copyright (C) 2023 Hack.bg

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

import { Error as ConnectError } from '@fadroma/connect'

import { dirname } from 'node:path'

class FadromaError extends ConnectError {
  static Build:  typeof BuildError
  static Upload: typeof UploadError
  static Deploy: typeof DeployError
  static Devnet: typeof DevnetError
}

export class BuildError extends FadromaError {
  static ScriptNotSet = this.define('ScriptNotSet',
    ()=>'build script not set')
  static NoHistoricalManifest = this.define('NoHistoricalManifest',
    ()=>'the workspace manifest option can only be used when building from working tree')
  static NoGitDir = this.define('NoGitDir',
    ()=>'could not find .git directory')
}

export class UploadError extends FadromaError {}

export class DeployError extends FadromaError {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists', (name: string)=>
    `deployment "${name}" already exists`)
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist', (name: string)=>
    `deployment "${name}" does not exist`)
}

export class DevnetError extends FadromaError {
  static PortMode = this.define('PortMode',
    (mode?: string) => `devnet.portMode must be either 'lcp' or 'grpcWeb', found: ${mode}`)
  static NoChainId = this.define('NoChainId',
    ()=>'refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'devnet.container is not set')
  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>`genesis account not found: ${name} (${error})`)
  static NotADirectory = this.define('NotADirectory',
    (path: string) => `not a directory: ${path}`)
  static NotAFile = this.define('NotAFile',
    (path: string) => `not a file: ${path}`)
  static CantExport = this.define('CantExport',
    (reason: string) => `can't export: ${reason}`)
  static LoadingFailed = this.define('LoadingFailed',
    (path: string, cause?: Error) =>
      `failed restoring devnet state from ${path}; ` +
      `try deleting ${dirname(path)}` +
      (cause ? ` ${cause.message}` : ``),
    (error: any, path: string, cause?: Error) =>
      Object.assign(error, { path, cause }))
}

export default Object.assign(FadromaError, {
  Build:  BuildError,
  Upload: UploadError,
  Deploy: DeployError,
  Devnet: DevnetError
})

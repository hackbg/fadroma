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

class FadromaError extends ConnectError {
  static Build:  typeof BuildError
  static Upload: typeof UploadError
  static Deploy: typeof DeployError
  static Devnet: typeof DevnetError
}

export class BuildError extends FadromaError {}

export class UploadError extends FadromaError {}

export class DeployError extends FadromaError {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists', (name: string)=>
    `Deployment "${name}" already exists`)
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist', (name: string)=>
    `Deployment "${name}" does not exist`)
}

export class DevnetError extends FadromaError {
  static PortMode = this.define('PortMode',
    ()=>"Devnet#portMode must be either 'lcp' or 'grpcWeb'")
  static NoChainId = this.define('NoChainId',
    ()=>'Refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'Devnet#container is not set')
  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)
}

export default Object.assign(FadromaError, {
  Build:  BuildError,
  Upload: UploadError,
  Deploy: DeployError,
  Devnet: DevnetError
})

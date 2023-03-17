/*
  Fadroma Deployment and Operations System
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

import YAML1 from './DeployStore_YAML_v1'
import YAML2 from './DeployStore_YAML_v2'
import JSON1 from './DeployStore_JSON_v1'
import type Deployer from './Deployer'
import DeployConfig from './DeployConfig'
import UploaderConfig from './UploadConfig'
import { DeployStore, Deployment } from '@fadroma/core'
import type { Uploader, Uploadable, Uploaded, DeploymentClass } from '@fadroma/core'
import type { Many } from '@hackbg/many'
import YAML from 'js-yaml'

Object.assign(DeployStore.variants, { YAML1, YAML2, JSON1 })

export { DeployStore, YAML, YAML1, YAML2, JSON1 }

export { default as DeployConfig } from './DeployConfig'
export * from './DeployConfig'

export { default as DeployConsole } from './DeployConsole'
export * from './DeployConsole'

export { default as DeployError } from './DeployError'
export * from './DeployError'

export { default as Deployer } from './Deployer'
export * from './Deployer'

export function getDeployer <D extends Deployment> (
  options: Partial<DeployConfig> = {},
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): Promise<Deployer<D>> {
  return new DeployConfig(options).getDeployer($D, ...args)
}

export { default as FSUploader } from './FSUploader'
export * from './FSUploader'

export { default as UploadConsole } from './UploadConsole'
export * from './UploadConsole'

export { default as UploadError } from './UploadError'
export * from './UploadError'

export { default as UploadStore } from './UploadStore'
export * from './UploadStore'

export function getUploader (options: Partial<UploaderConfig> = {}): Uploader {
  return new UploaderConfig(options).getUploader()
}

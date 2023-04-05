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

export * from './devnet/index'
import { DevnetConfig } from './devnet/index'
/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<DevnetConfig> = {}) {
  return new DevnetConfig(options).getDevnet()
}

export * from './project/index'
import { Project } from './project/index'
import $, { OpaqueDirectory, JSONFile } from '@hackbg/file'
/** @returns Project with config from "fadroma" key in package.json */
export function getProject (
  path: string|OpaqueDirectory = process.env.FADROMA_PROJECT || process.cwd()
): Project {
  const packageJSON = $(path).as(OpaqueDirectory).at('package.json').as(JSONFile).load()
  const { fadroma } = packageJSON as { fadroma: any }
  return new Project(fadroma)
}

export * from './build/index'
import { BuilderConfig } from './build/index'
import type { Builder } from '@fadroma/agent'
/** @returns Builder configured as per environment and options */
export function getBuilder (options: Partial<BuilderConfig> = {}): Builder {
  return new BuilderConfig(options).getBuilder()
}

export * from './upload/index'
import { UploadConfig } from './upload/index'
import type { Uploader } from '@fadroma/agent'
/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new UploadConfig(options).getUploader()
}

export * from './deploy/index'
import type { Deployer } from './deploy/index'
import { DeployConfig } from './deploy/index'
import type { DeploymentClass } from '@fadroma/agent'
import { Deployment } from '@fadroma/agent'
/** @returns Deployer configured as per environment and options */
export function getDeployer <D extends Deployment> (
  options: Partial<DeployConfig> = {},
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): Promise<Deployer<D>> {
  return new DeployConfig(options).getDeployer($D, ...args)
}

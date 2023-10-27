/**

  Fadroma
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

import type {
  Agent,
  Builder,
  CompiledCode,
  DeploymentClass
} from '@fadroma/connect'
import {
  Deployment,
  Error,
} from '@fadroma/connect'
import {
  Config
} from './ops/config'

/** @returns Agent configured as per environment and options */
export function getAgent (options: Partial<Config> = {}): Agent {
  return new Config().getAgent()
}

/** Upload a single contract with default settings. */
export function upload (...args: Parameters<Agent["upload"]>) {
  return getAgent().upload(...args)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (...args: Parameters<Agent["uploadMany"]>) {
  return getAgent().uploadMany(...args)
}

/** @returns Deployment configured according to environment and options */
export function getDeployment <D extends Deployment> (
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): D {
  return new Config().getDeployment($D, ...args)
}

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<Config["devnet"]> = {}) {
  return new Config({ devnet: options }).getDevnet()
}

export * from '@fadroma/connect'
export * from './ops/build'
export * from './ops/config'
export * from './ops/deploy'
export * from './ops/devnet'
export * from './ops/project'
export * from './ops/upload'
export * from './ops/wizard'
export { Config } from './ops/config'

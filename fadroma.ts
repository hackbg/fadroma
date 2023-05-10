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

export * from './fadroma-base'
export * from './fadroma-build'
export * from './fadroma-upload'
export * from './fadroma-deploy'
export * from './devnet/devnet'
export * from './fadroma-project'

import { Project } from './fadroma-project'
export default Project

import { Config } from './fadroma-base'

/** @returns Deployment configured according to environment and options */
export function getDeployment <D extends Deployment> (
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): D {
  return new Config().getDeployment($D, ...args)
}

// This installs devnet:
import type { ChainRegistry, DeploymentClass } from '@fadroma/agent'
import { Chain, ChainMode, Deployment } from '@fadroma/agent'
import { Scrt } from '@fadroma/connect'
Object.assign(Chain.variants as ChainRegistry, {
  ScrtDevnet (options: Partial<Scrt.Chain> = {}): Scrt.Chain {
    const config = new Config()
    const devnet = config.getDevnet({ platform: 'scrt_1.8' })
    const id     = devnet.chainId
    const url    = devnet.url.toString()
    return Scrt.Chain.devnet({ id, url, devnet, ...options })
  }
})

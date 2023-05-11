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
export { Project as default } from './fadroma-project'

import { Config } from './fadroma-base'
import type { Devnet } from './devnet/devnet'
import type { ChainRegistry, ChainClass, DeploymentClass } from '@fadroma/agent'
import { Chain, ChainMode, Deployment } from '@fadroma/agent'
import { Scrt } from '@fadroma/connect'

/** @returns Deployment configured according to environment and options */
export function getDeployment <D extends Deployment> (
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): D {
  return new Config().getDeployment($D, ...args)
}

// This installs devnet:
Chain.variants['ScrtDevnet'] =
  (options: Partial<Devnet> = { platform: 'scrt_1.8' }): Scrt.Chain =>
    new Config().getDevnet(options).getChain(Scrt.Chain as ChainClass<Scrt.Chain>)

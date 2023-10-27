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
  DeploymentClass,
  ChainClass
} from '@fadroma/connect'
import {
  connectModes,
  Deployment,
  Error,
  CW,
  Scrt
} from '@fadroma/connect'
import {
  Config,
  DevnetConfig
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
export function getDevnet (options: Partial<DevnetConfig> = {}) {
  return new DevnetConfig({ devnet: options }).getDevnet()
}

// Installs devnets as selectable chains:
connectModes['ScrtDevnet'] = Scrt.Chain.devnet =
  (options: Partial<Scrt.Chain>|undefined): Scrt.Chain =>
    new Config().devnet
      .getDevnet({ platform: 'scrt_1.9' })
      .getChain(Scrt.Chain as ChainClass<Scrt.Chain>, options)

connectModes['OKP4Devnet'] = CW.OKP4.Chain.devnet = 
  (options: Partial<CW.OKP4.Chain>|undefined): CW.OKP4.Chain =>
    new Config().devnet
      .getDevnet({ platform: 'okp4_5.0' })
      .getChain(CW.OKP4.Chain as ChainClass<CW.OKP4.Chain>, options)

export * from '@fadroma/connect'
export * from './ops/build'
export * from './ops/config'
export * from './ops/deploy'
export * from './ops/devnet'
export * from './ops/project'
export * from './ops/upload'
export * from './ops/wizard'
export { Config } from './ops/config'

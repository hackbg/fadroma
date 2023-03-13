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

import { DeployStore } from '@fadroma/core'
import YAML from 'js-yaml'
import YAML1 from './DeployStore_YAML_v1'
import YAML2 from './DeployStore_YAML_v2'
import JSON1 from './DeployStore_JSON_v1'

Object.assign(DeployStore.variants, { YAML1, YAML2, JSON1 })

export { DeployStore, YAML, YAML1, YAML2, JSON1 }

export { default as DeployConfig } from './DeployConfig'
export * from './DeployConfig'

export { default as DeployConsole } from './DeployConsole'
export * from './DeployConsole'

export { default as DeployError } from './DeployError'
export * from './DeployError'

export { default as DeployerCommands } from './DeployerCommands'
export * from './DeployerCommands'

export { default as Deployer } from './Deployer'
export * from './Deployer'

export * from './upload'

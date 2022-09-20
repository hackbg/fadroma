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

import YAML from 'js-yaml'
import * as YAML1 from './deploy-yaml1'
import * as YAML2 from './deploy-yaml2'
import * as JSON1 from './deploy-json1'
import { DeployStores } from './deploy-config'

DeployStores['YAML1'] = YAML1.YAMLDeployments_v1
DeployStores['YAML2'] = YAML2.YAMLDeployments_v2
DeployStores['JSON1'] = JSON1.JSONDeployments_v1

export { YAML, DeployStores, YAML1, YAML2, JSON1 }
export { DeployContext, DeployStore } from './deploy-base'
export { DeployConsole } from './deploy-events'
export { DeployConfig } from './deploy-config'
export * from './upload'

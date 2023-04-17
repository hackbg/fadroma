import Config from '../Config'

import { Deployment, DeployStore } from '@fadroma/agent'
import type { DeploymentClass } from '@fadroma/agent'

import YAML from 'js-yaml'
import YAML1 from './DeployStore_YAML_v1'
import YAML2 from './DeployStore_YAML_v2'
import JSON1 from './DeployStore_JSON_v1'
Object.assign(DeployStore.variants, { YAML1, YAML2, JSON1 })

/** @returns Deployment configured as per environment and options */
export function getDeployment <D extends Deployment> (
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): D {
  return new Config().getDeployment($D, ...args)
}

export { DeployStore, YAML, YAML1, YAML2, JSON1 }

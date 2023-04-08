export { default as DeployConsole } from './DeployConsole'
export * from './DeployConsole'

export { default as DeployError } from './DeployError'
export * from './DeployError'

export { default as DeployConfig } from './DeployConfig'
export * from './DeployConfig'

import { DeployStore } from '@fadroma/agent'
import YAML from 'js-yaml'
import YAML1 from './DeployStore_YAML_v1'
import YAML2 from './DeployStore_YAML_v2'
import JSON1 from './DeployStore_JSON_v1'
Object.assign(DeployStore.variants, { YAML1, YAML2, JSON1 })
export { DeployStore, YAML, YAML1, YAML2, JSON1 }

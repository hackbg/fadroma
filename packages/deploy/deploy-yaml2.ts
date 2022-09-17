import { Deployment } from '@fadroma/client'
import { Deployments } from './deploy-base'
import $, { Path, YAMLDirectory, YAMLFile, JSONFile, alignYAML } from '@hackbg/kabinet'

/** Output of the alternate Rust-based deployer. */
export class YAMLDeployments_v2 extends Deployments {

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>
  ) {
    super()
    this.store = $(storePath).as(YAMLDirectory)
  }

  store: YAMLDirectory<unknown>

}

export class YAMLDeployment_v1 extends Deployment {}

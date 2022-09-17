import { Deployment } from '@fadroma/client'
import { Deployments } from './deploy-base'
import $, { Path, JSONDirectory } from '@hackbg/kabinet'

/** JSON receipts. Importable from client libraries. */
export class JSONDeployments_v1 extends Deployments {

  constructor (
    storePath: string|Path|JSONDirectory<unknown>
  ) {
    super()
    this.store = $(storePath).as(JSONDirectory)
  }

  store: JSONDirectory<unknown>

}

export class JSONDeployment_v1 extends Deployment {}

import { Console } from '../util'

import type { AnyContract, DeploymentState } from '@fadroma/agent'
import { Contract, Deployment, DeployStore, timestamp } from '@fadroma/agent'

import $, { Path, JSONDirectory } from '@hackbg/file'

/** JSON receipts. Importable from client libraries. */
export default class JSONDeployments_v1 extends DeployStore {

  constructor (
    storePath: string|Path|JSONDirectory<unknown>,
    public defaults: Partial<Deployment> = {}
  ) {
    super()
    this.store = $(storePath).as(JSONDirectory)
  }

  store: JSONDirectory<unknown>

  log = new Console('@fadroma/ops: json 1')

  async create (name: string = timestamp()): Promise<DeploymentState> {
    throw new Error('Not implemented')
  }

  async select (name: string): Promise<DeploymentState> {
    throw new Error('Not implemented')
  }

  list (): string[] {
    throw new Error('Not implemented')
  }

  load (name: string): DeploymentState|null {
    throw new Error('Not implemented')
  }

  save (name: string, state: DeploymentState = {}) {
    throw new Error('Not implemented')
  }

  get active (): DeploymentState|null {
    throw new Error('Not implemented')
  }

}


import { timestamp } from '@hackbg/konzola'
import { Deployment } from '@fadroma/client'
import { DeployStore } from './deploy-base'
import $, { Path, JSONDirectory } from '@hackbg/kabinet'

/** JSON receipts. Importable from client libraries. */
export class JSONDeployments_v1 extends DeployStore {

  constructor (
    storePath: string|Path|JSONDirectory<unknown>,
    public defaults: Partial<Deployment> = {}
  ) {
    super()
    this.store = $(storePath).as(JSONDirectory)
  }

  store: JSONDirectory<unknown>

  async create (name: string = timestamp()): Promise<Deployment> {
    throw new Error('Not implemented')
  }

  async select (name: string): Promise<Deployment> {
    throw new Error('Not implemented')
  }

  get (name: string): Deployment|null {
    throw new Error('Not implemented')
  }

  list (): string[] {
    throw new Error('Not implemented')
  }

}

export class JSONDeployment_v1 extends Deployment {}

import { timestamp } from '@hackbg/konzola'
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

export class YAMLDeployment_v2 extends Deployment {}

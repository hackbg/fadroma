import { DeployConsole } from '../util'

import type { AnyContract, DeploymentState } from '@fadroma/agent'
import { Contract, Deployment, DeployStore, timestamp } from '@fadroma/agent'

import $, { Path, YAMLDirectory, YAMLFile, JSONFile, alignYAML } from '@hackbg/file'

/** Output of the alternate Rust-based deployer. */
export default class YAMLDeployments_v2 extends DeployStore {

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
  ) {
    super()
    this.store = $(storePath).as(YAMLDirectory)
  }

  log = new DeployConsole('@fadroma/ops: yaml 2')

  store: YAMLDirectory<unknown>

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

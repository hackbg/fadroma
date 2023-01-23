import { timestamp } from '@hackbg/logs'
import type { AnyContract } from '@fadroma/core'
import { Contract, Deployment, DeployStore } from '@fadroma/core'
import $, { Path, YAMLDirectory, YAMLFile, JSONFile, alignYAML } from '@hackbg/file'

/** Output of the alternate Rust-based deployer. */
export class YAMLDeployments_v2 extends DeployStore {

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
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

  get active (): Deployment|null {
    throw new Error('Not implemented')
  }

  set (name: string, state: Record<string, AnyContract> = {}) {
    throw new Error('Not implemented')
  }

}

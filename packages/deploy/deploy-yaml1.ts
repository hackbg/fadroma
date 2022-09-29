import {
  loadAll, dump
} from 'js-yaml'
import {
  timestamp, bold
} from '@hackbg/konzola'
import $, {
  Path, YAMLDirectory, YAMLFile, TextFile, alignYAML, OpaqueDirectory
} from '@hackbg/kabinet'
import {
  Agent, Contract, Client, Deployment, DeployStore
} from '@fadroma/client'
import {
  DeployConsole, DeployError, log
} from './deploy-events'
import {
  basename
} from 'node:path'

import * as FS from 'node:fs' // TODO replace with calls to @hackbg/kabinet

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class YAMLDeployments_v1 extends DeployStore {

  constructor (
    public defaults: Partial<Deployment> = {},
    storePath: string|Path|YAMLDirectory<unknown>,
  ) {
    super()
    this.root = $(storePath).as(YAMLDirectory)
  }

  root: YAMLDirectory<unknown>

  log = new DeployConsole('Fadroma Deploy (YAML1)')

  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()): Promise<Deployment> {
    this.log.log('Creating:', bold(name))
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    this.log.log('Receipt:', bold(path.shortPath))
    path.makeParent().as(YAMLFile).save(undefined)
    return this.get(name)!
  }

  /** Make the specified deployment be the active deployment. */
  async select (name: string = this.KEY): Promise<Deployment> {
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      if (name === this.KEY) name = active.real.name
      name = basename(name, '.yml')
      active.relLink(`${name}.yml`)
      this.log.log('Activate:', bold(selected.real.name))
      return this.get(name)!
    } else if (name === this.KEY) {
      const d = await this.create()
      const name = d.name
      return this.select(name)
    } else {
      throw new DeployError.DeploymentDoesNotExist(name)
    }
  }

  // FIXME turn this into a getDeployment(name) factory?
  get active () {
    return this.get(this.KEY)
  }

  /** Get the contents of the named deployment, or null if it doesn't exist. */
  get (name: string): Deployment|null {
    let file = this.root.at(`${name}.yml`)
    if (!file.exists()) return null
    name = basename(file.real.name, '.yml')
    const deployment = new Deployment({ ...this.defaults, name })
    for (const receipt of file.as(YAMLFile).loadAll() as Partial<Contract<any>>[]) {
      if (!receipt.name) continue
      deployment.state[receipt.name] = new Contract(receipt)
    }
    return deployment
  }

  /** List the deployments in the deployments directory. */
  list (): string[] {
    if (this.root.exists()) {
      const list = this.root.as(OpaqueDirectory).list() ?? []
      return list.filter(x=>x.endsWith('.yml')).map(x=>basename(x, '.yml')).filter(x=>x!=this.KEY)
    } else {
      log.deployStoreDoesNotExist(this.root.shortPath)
      return []
    }
  }

  set (name: string, state: Record<string, Partial<Contract<any>>> = {}) {
    this.root.make()
    const file = this.root.at(`${name}.yml`)
    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(state)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new Error('Deployment: no name')
      data = JSON.parse(JSON.stringify({
        name,
        ...new Contract(data).asMetadata,
        deployment: undefined
      }))
      const daDump = dump(data, { noRefs: true })
      output += alignYAML(daDump)
    }
    file.as(TextFile).save(output)
    return this
  }

};

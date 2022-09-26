import { loadAll, dump } from 'js-yaml'
import { timestamp } from '@hackbg/konzola'
import $, {
  Path, YAMLDirectory, YAMLFile, JSONFile, alignYAML, OpaqueDirectory
} from '@hackbg/kabinet'
import { Agent, Contract, Client, Deployment } from '@fadroma/client'
import { DeployStore } from './deploy-base'
import { DeployError, log } from './deploy-events'

import { basename } from 'node:path'

import * as FS from 'node:fs' // TODO replace with calls to @hackbg/kabinet

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class YAMLDeployments_v1 extends DeployStore {

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
  ) {
    super()
    this.store = $(storePath).as(YAMLDirectory)
  }

  store: YAMLDirectory<unknown>

  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()): Promise<Deployment> {
    const path = this.store.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    path.makeParent().as(YAMLFile).save(undefined)
    return this.get(name)
  }

  /** Make the specified deployment be the active deployment. */
  async select (name: string): Promise<Deployment> {
    const selected = this.store.at(`${name}.yml`)
    if (!selected.exists) throw new DeployError.DeploymentDoesNotExist(name)
    const active = this.store.at(`${this.KEY}.yml`).as(YAMLFile)
    try { active.delete() } catch (e) {}
    await FS.symlinkSync(selected.path, active.path)
    return this.get(name)
  }

  /** Get the contents of the named deployment, or null if it doesn't exist. */
  get (name: string): Deployment {
    const path = this.store.at(`${name}.yml`)
    if (!path.exists()) return new Deployment(this.defaults)
    return new Deployment(new YAMLDeployment_v1(path.path))
  }

  /** List the deployments in the deployments directory. */
  list (): string[] {
    if (this.store.exists()) {
      const list = this.store.as(OpaqueDirectory).list() ?? []
      return list.filter(x=>x.endsWith('.yml')).map(x=>basename(x, '.yml')).filter(x=>x!=this.KEY)
    } else {
      log.deployStoreDoesNotExist(this.store.shortPath)
      return []
    }
  }

  update (name: string, state: Record<string, Partial<Contract<any>>> = {}) {
    this.store.make()
    const path = this.store.at(`${name}.yml`).path
    $(path).as(YAMLFile).make()
    const file = new YAMLDeployment_v1(path)
    Object.assign(file.state, state)
    file.save(path)
  }

}

export class YAMLDeployment_v1 extends Deployment {

  constructor (path?: string, agent?: Agent) {
    if (path) {
      const file = $(path).as(YAMLFile)
      super({ name: file.name, agent })
      this.file = file
      this.load()
    } else {
      super({ agent })
    }
  }

  file?: YAMLFile<unknown>

  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    // Expect path to be present
    if (!this.file) throw new Error('Deployment: no path to resolve by')
    return $(this.file, ...fragments).path
  }

  /** Load deployment state from YAML file. */
  load (file: Path|string|undefined = this.file) {
    // Expect path to be present
    if (!file) throw new Error('Deployment: no path to load from')
    // Resolve symbolic links
    file = $(file).real
    // Load the receipt data
    for (const receipt of file.as(YAMLFile).loadAll() as Partial<Contract<any>>[]) {
      if (!receipt.name) continue
      const [contractName, _version] = receipt.name.split('+')
      const contract = this.state[contractName] = new Contract({}, receipt)
    }
    // TODO: Automatically convert receipts to Client subclasses
    // by means of an identifier shared between the deploy and client libraries
  }

  /** Chainable: Serialize deployment state to YAML file. */
  save (file?: Path|string): this {

    // Expect path to be present
    file ??= this.file
    if (!file) throw new Error('Deployment: no path to save to')
    if (!(typeof file === 'string')) file = file.path

    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(this.state)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new Error('Deployment: no name')
      data = JSON.parse(JSON.stringify({
        ...new Contract(data).asMetadata,
        name,
        deployment: undefined
      }))
      const daDump = dump(data, { noRefs: true })
      output += alignYAML(daDump)
    }

    // Write the data to disk.
    FS.writeFileSync(file, output)
    return this
  }

  set (name: string, data: Partial<Client> & any): this {
    super.set(name, data)
    return this.save()
  }

  setMany (data: Record<string, Client>): this {
    super.setMany(data)
    return this.save()
  }

}

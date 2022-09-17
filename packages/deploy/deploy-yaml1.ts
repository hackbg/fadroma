import { loadAll, dump } from 'js-yaml'
import { timestamp } from '@hackbg/konzola'
import $, { Path, YAMLDirectory, YAMLFile, JSONFile, alignYAML } from '@hackbg/kabinet'
import { Agent, Contract, Client, Deployment } from '@fadroma/client'
import { Deployments } from './deploy-base'

import * as FS from 'node:fs' // TODO replace with calls to @hackbg/kabinet

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class YAMLDeployments_v1 extends Deployments {

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>
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
    if (path.exists()) {
      throw new Error(`${name} already exists`)
    }
    path.makeParent().as(YAMLFile).save(undefined)
    return new Deployment(new YAMLDeployment_v1(path.path))
  }

  /** Make the specified deployment be the active deployment. */
  async select (name: string): Promise<Deployment> {
    const selection = this.store.at(`${name}.yml`)
    if (!selection.exists) {
      throw new Error(`Deployment ${name} does not exist`)
    }
    const active = this.store.at(`${this.KEY}.yml`).as(YAMLFile)
    try { active.delete() } catch (e) {}
    await FS.symlinkSync(selection.path, active.path)
    return null
  }

  /** Get the contents of the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }

  /** Get the contents of the named deployment, or null if it doesn't exist. */
  get (name: string): Deployment|null {
    const path = resolve(this.store.path, `${name}.yml`)
    if (!FS.existsSync(path)) return null
    return new Deployment(new YAMLDeployment(path))
  }

  /** List the deployments in the deployments directory. */
  list () {
    if (!FS.existsSync(this.store.path)) return []
    return FS.readdirSync(this.store.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
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
    return resolve(this.file.path, ...fragments)
  }

  /** Load deployment state from YAML file. */
  load (file?: Path|string) {

    // Expect path to be present
    file ??= this.file
    if (!file) throw new Error('Deployment: no path to load from')

    // Resolve symbolic links
    if (!(typeof file === 'string')) file = file.path
    while (FS.lstatSync(file).isSymbolicLink()) {
      file = resolve(dirname(file), FS.readlinkSync(file))
    }

    // Load the receipt data
    const data = FS.readFileSync(file, 'utf8')
    const receipts = loadAll(data) as Partial<Contract<any>>[]
    for (const receipt of receipts) {
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
      data = JSON.parse(JSON.stringify({ ...data, name, deployment: undefined }))
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

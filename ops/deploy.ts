/**
  Fadroma: copyright (C) 2023 Hack.bg, licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import {
  Console, bold, Error, timestamp, 
  DeployStore, ContractInstance,
  Config
} from '@fadroma/connect'
import type { Deployment, DeploymentState, Environment } from '@fadroma/connect'
import $, {
  OpaqueDirectory, YAMLDirectory, YAMLFile, TextFile, alignYAML
} from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { basename } from 'node:path'

import YAML, { loadAll, dump } from 'js-yaml'

export { DeployStore }

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class FSDeployStore extends DeployStore {
  log = new DeployConsole('DeployStore_v1')
  /** Root directory of deploy store. */
  root: YAMLDirectory<unknown>
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
  ) {
    super()
    const root = this.root = $(storePath).as(YAMLDirectory)
    this.log.label = `${this.root.shortPath}`
    Object.defineProperty(this, 'root', {
      enumerable: true,
      get () { return root }
    })
  }

  get [Symbol.toStringTag]() {
    return `${this.root?.shortPath??'-'}`
  }

  /** Get name of the active deployment, or null if there isn't one. */
  get activeName (): string|null {
    let file = this.root.at(`${this.KEY}.yml`)
    if (!file.exists()) return null
    return basename(file.real.name, '.yml')
  }

  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()): Promise<DeploymentState> {
    if (!this.root.exists()) {
      this.log('creating', this.root.shortPath)
      this.root.make()
    }
    this.log.creating(name)
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    this.log.location(path.shortPath)
    path.makeParent().as(YAMLFile).save('')
    return this.load(name)
  }

  /** Activate the named deployment, or throw if such doesn't exist. */
  async select (name: string|null = this.activeName): Promise<DeploymentState> {
    if (!name) throw new DeployError('no deployment selected')
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      this.log.activating(selected.real.name)
      const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      if (name === this.KEY) name = active.real.name
      name = basename(name, '.yml')
      active.relLink(`${name}.yml`)
      return this.load(name)!
    }
    throw new DeployError.DeploymentDoesNotExist(name)
  }

  /** Get the names of all stored deployments. */
  list (): string[] {
    if (this.root.exists()) {
      const list = this.root.as(OpaqueDirectory).list() ?? []
      return list
        .filter(x=>x.endsWith('.yml'))
        .map(x=>basename(x, '.yml'))
        .filter(x=>x!=this.KEY)
    } else {
      this.log.warn(`deployment store does not exist`)
      return []
    }
  }

  /** Get the contents of the named deployment, or null if it doesn't exist. */
  load (name: string|null|undefined = this.activeName): DeploymentState {
    if (!name) throw new DeployError('pass deployment name')
    const file = this.root.at(`${name}.yml`)
    this.log.log('loading', name)
    name = basename(file.real.name, '.yml')
    const state: DeploymentState = {}
    for (const receipt of file.as(YAMLFile).loadAll() as Partial<ContractInstance>[]) {
      if (!receipt.name) continue
      state[receipt.name] = receipt
    }
    return state
  }

  /** Update a deployment's stored data. */
  save (name: string, state: DeploymentState = {}) {
    this.root.make()
    const file = this.root.at(`${name}.yml`)
    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(state.contracts!)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new DeployError('Deployment: no name')
      const receipt: any = new ContractInstance(data).toInstanceReceipt()
      data = JSON.parse(JSON.stringify({
        name,
        label:    receipt.label,
        address:  receipt.address,
        codeHash: receipt.codeHash,
        codeId:   receipt.label,
        crate:    receipt.crate,
        revision: receipt.revision,
        ...receipt,
        deployment: undefined
      }))
      const daDump = dump(data, { noRefs: true })
      output += alignYAML(daDump)
    }
    file.as(TextFile).save(output)
    return this
  }
}

export class DeployConfig extends Config {
  constructor (
    options: Partial<DeployConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }

  multisig = this.getFlag('FADROMA_MULTISIG',
    () => false
  )
  /** Directory to store the receipts for the deployed contracts. */
  storePath = this.getString('FADROMA_DEPLOY_STATE',
    () => this.chainId
      ? $(this.root).in('state').in(this.chainId).in('deploy').path
      : null
  )
  /** Which implementation of the receipt store to use. */
  format = this.getString('FADROMA_DEPLOY_FORMAT',
    () => 'v1'
  ) as DeploymentFormat
  /** @returns DeployStoreClass selected by `this.deploy.format` (`FADROMA_DEPLOY_FORMAT`). */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore
  }
  /** @returns DeployStore or subclass instance */
  getDeployStore <T extends DeployStore> (
    DeployStore?: DeployStoreClass<T> = this.DeployStore
  ): T {
    return new DeployStore({})
    //DeployStore ??= this.DeployStore as DeployStoreClass<T>
    //if (!DeployStore) throw new Error.Missing.DeployStoreClass()
    //return new DeployStore(this.deploy.storePath)
  }
  /** Create a new Deployment.
    * If a deploy store is specified, populate it with stored data (if present).
    * @returns Deployment or subclass */
  getDeployment <T extends BaseDeployment> (
    Deployment: DeploymentClass<T>,
    ...args: ConstructorParameters<typeof Deployment>
  ): T {
    Deployment ??= BaseDeployment as DeploymentClass<T>
    args = [...args]
    args[0] = ({ ...args[0] ?? {} })
    args[0].chain     ||= this.getChain()
    if (!args[0].chain) throw new Error.Missing.Chain()
    args[0].agent     ||= this.getAgent()
    args[0].builder   ||= this.getBuilder()
    args[0].workspace ||= process.cwd()
    args[0].store     ||= this.getDeployStore()
    args[0].name      ||= args[0].store.activeName || undefined
    const deployment = args[0].store.getDeployment(Deployment, ...args)
    return deployment
  }
}

export class DeployConsole extends Console {
  creating (name: string) {
    return this.log('creating', bold(name))
  }
  location (path: string) {
    return this.log('location', bold(path))
  }
  activating (name: string) {
    return this.log('activate', bold(name))
  }
  list (chainId: string, deployments: DeployStore) {
    const list = [...deployments.keys()]
    if (list.length > 0) {
      this.info(`deployments on ${bold(chainId)}:`)
      let maxLength = 0
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        maxLength = Math.max(name.length, maxLength)
      }
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        const deployment = deployments.get(name)!
        let info = `${bold(name.padEnd(maxLength))}`
        info = `${info} (${deployment.contracts.size()} contracts)`
        if (deployments.activeName === name) info = `${info} ${bold('selected')}`
        this.info(` `, info)
      }
    } else {
      this.info(`no deployments on ${bold(chainId)}`)
    }
  }
}

export class DeployError extends Error {
  static DeploymentAlreadyExists = this.define(
    'DeploymentAlreadyExists', (name: string)=>`deployment "${name}" already exists`
  )
  static DeploymentDoesNotExist = this.define(
    'DeploymentDoesNotExist', (name: string)=> `deployment "${name}" does not exist`
  )
}

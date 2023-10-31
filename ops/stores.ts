/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Console, Error, bold, timestamp, UploadStore, DeployStore, ContractInstance, Deployment
} from '@fadroma/connect'
import type {
  CodeHash, UploadedCode, DeploymentState, Name
} from '@fadroma/connect'
import $, {
  OpaqueDirectory, BinaryFile, TextFile,
  JSONDirectory, JSONFile,
} from '@hackbg/file'
import type {
  Path
} from '@hackbg/file'
import {
  fileURLToPath
} from 'node:url'
import {
  basename
} from 'node:path'

/** Directory containing upload receipts, e.g. `state/$CHAIN/upload`. */
export class JSONFileUploadStore extends UploadStore {
  log = new Console('FSUploadStore')

  dir: JSONDirectory<Partial<UploadedCode>>

  constructor (dir: string) {
    super()
    this.dir = $(dir).as(JSONDirectory<Partial<UploadedCode>>)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.shortPath??'-'}`
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): UploadedCode|undefined {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new Error.Missing.CodeHash()
    const receipt = this.dir.at(`${codeHash!.toLowerCase()}.json`).as(JSONFile<any>)
    if (receipt.exists()) {
      const uploaded = receipt.load()
      if (uploaded.codeId) {
        this.log('loading code id', bold(String(uploaded.codeId)), 'from', bold(receipt.shortPath))
        super.set(codeHash, uploaded)
      } else {
        this.log.warn('no codeId field found in', bold(receipt.shortPath))
      }
    }
    return super.get(codeHash)
  }

  set (codeHash: CodeHash|{ codeHash: CodeHash }, value: Partial<UploadedCode>): this {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new Error.Missing.CodeHash()
    const receipt = this.dir.at(`${codeHash.toLowerCase()}.json`).as(JSONFile<any>)
    this.log('writing', receipt.shortPath)
    receipt.save(super.get(codeHash)!.toReceipt())
    return super.set(codeHash, value)
  }
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`. */
export class JSONFileDeployStore extends DeployStore {
  log = new Console('DeployStore_v1')
  /** Root directory of deploy store. */
  dir: JSONDirectory<DeploymentState>
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (dir: string,) {
    super()
    this.dir = $(dir).as(JSONDirectory<DeploymentState>)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.shortPath??'-'}`
  }

  get (name: Name): DeploymentState|undefined {
    const receipt = this.dir.at(`${name}.json`).as(JSONFile<any>)
    if (receipt.exists()) {
      const state = receipt.load()
      this.log('loading code id', bold(name), 'from', bold(receipt.shortPath))
      super.set(name, state)
    }
    return super.get(name)
  }

  set (name: Name, state: Partial<Deployment>|DeploymentState): this {
    if (state instanceof Deployment) state = state.toReceipt()
    const receipt = this.dir.at(`${name}.json`).as(JSONFile<any>)
    this.log('writing', receipt.shortPath)
    receipt.save(state)
    super.set(name, state)
    return this
  }

  /** Get name of the active deployment, or null if there isn't one. */
  //get activeName (): string|null {
    //let file = this.root.at(`${this.KEY}.yml`)
    //if (!file.exists()) return null
    //return basename(file.real.name, '.yml')
  //}

  //[>* Create a deployment with a specific name. <]
  //async create (name: string = timestamp()): Promise<DeploymentState> {
    //if (!this.root.exists()) {
      //this.log('creating', this.root.shortPath)
      //this.root.make()
    //}
    //const path = this.root.at(`${name}.yml`)
    //if (path.exists()) {
      //throw new Error(`deployment already exists at ${path.shortPath}`)
    //}
    //this.log.log('creating deployment at', bold(path.shortPath))
    //path.makeParent().as(YAMLFile).save('')
    //return this.load(name)
  //}

  //[>* Activate the named deployment, or throw if such doesn't exist. <]
  //async select (name: string|null = this.activeName): Promise<DeploymentState> {
    //if (!name) throw new Error('no deployment selected')
    //let selected = this.root.at(`${name}.yml`)
    //if (selected.exists()) {
      //this.log.log('activating deployment at', bold(selected.shortPath))
      //const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      //if (name === this.KEY) name = active.real.name
      //name = basename(name, '.yml')
      //active.relLink(`${name}.yml`)
      //return this.load(name)!
    //}
    //throw new Error(`deployment ${name} does not exist`)
  //}

  //[>* Get the names of all stored deployments. <]
  //list (): string[] {
    //if (this.root.exists()) {
      //const list = this.root.as(OpaqueDirectory).list() ?? []
      //return list
        //.filter(x=>x.endsWith('.yml'))
        //.map(x=>basename(x, '.yml'))
        //.filter(x=>x!=this.KEY)
    //} else {
      //this.log.warn(`deployment store does not exist`)
      //return []
    //}
  //}

  //[>* Get the contents of the named deployment, or null if it doesn't exist. <]
  //load (name: string|null|undefined = this.activeName): DeploymentState {
    //if (!name) throw new Error('pass deployment name')
    //const file = this.root.at(`${name}.yml`)
    //this.log.log('loading', name)
    //name = basename(file.real.name, '.yml')
    //const state: DeploymentState = {}
    //for (const receipt of file.as(YAMLFile).loadAll() as Partial<ContractInstance>[]) {
      //if (!receipt.name) continue
      //state.units[receipt.name] = receipt
    //}
    //return state
  //}

  //[>* Update a deployment's stored data. <]
  //save (name: string, state: DeploymentState = {}) {
    //this.root.make()
    //const file = this.root.at(`${name}.yml`)
    //// Serialize data to multi-document YAML
    //let output = ''
    //for (let [name, data] of Object.entries(state.units!)) {
      //output += '---\n'
      //name ??= data.name!
      //if (!name) throw new Error("can't save a deployment with no name")
      //const receipt: any = new ContractInstance(data).toReceipt()
      //data = JSON.parse(JSON.stringify({
        //name,
        //label:    receipt.label,
        //address:  receipt.address,
        //codeHash: receipt.codeHash,
        //codeId:   receipt.label,
        //crate:    receipt.crate,
        //revision: receipt.revision,
        //...receipt,
        //deployment: undefined
      //}))
      //const daDump = dump(data, { noRefs: true })
      //output += alignYAML(daDump)
    //}
    //file.as(TextFile).save(output)
    //return this
  //}
}

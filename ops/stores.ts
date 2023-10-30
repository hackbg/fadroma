/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Console, Error, bold, UploadStore, DeployStore, ContractInstance
} from '@fadroma/connect'
import type {
  CodeHash, UploadedCode, Deployment, DeploymentState
} from '@fadroma/connect'
import $, {
  OpaqueDirectory, BinaryFile, TextFile,
  JSONDirectory, JSONFile,
  YAMLDirectory, YAMLFile, alignYAML
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

export class JSONFileUploadStore extends UploadStore {
  log = new Console('FSUploadStore')

  rootDir: JSONDirectory<unknown>

  constructor (
    rootDir: string
  ) {
    super()
    this.rootDir = $(rootDir).as(JSONDirectory)
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): UploadedCode|undefined {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new Error.Missing.CodeHash()
    const receipt = this.rootDir.at(`${codeHash!.toLowerCase()}.json`).as(JSONFile<any>)
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
    super.set(codeHash, value)
    const receipt = this.rootDir.at(`${codeHash.toLowerCase()}.json`).as(JSONFile<any>)
    this.log('writing', receipt.shortPath)
    receipt.save(super.get(codeHash)!.toReceipt())
    return this
  }

  protected addCodeHash (uploadable: Partial<UploadedCode> & { name: string }) {
    if (!uploadable.codeHash) {
      if (uploadable.codePath) {
        uploadable.codeHash = base16.encode(sha256(this.fetchSync(uploadable.codePath)))
        this.log(`hashed ${String(uploadable.codePath)}:`, uploadable.codeHash)
      } else {
        this.log(`no artifact, can't compute code hash for: ${uploadable?.name||'(unnamed)'}`)
      }
    }
  }

  protected async fetch (path: string|URL): Promise<Uint8Array> {
    return await Promise.resolve(this.fetchSync(path))
  }

  protected fetchSync (path: string|URL): Uint8Array {
    return $(fileURLToPath(new URL(path, 'file:'))).as(BinaryFile).load()
  }
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class YAMLFileDeployStore extends DeployStore {
  log = new Console('DeployStore_v1')
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
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) {
      throw new Error(`deployment already exists at ${path.shortPath}`)
    }
    this.log.log('creating deployment at', bold(path.shortPath))
    path.makeParent().as(YAMLFile).save('')
    return this.load(name)
  }

  /** Activate the named deployment, or throw if such doesn't exist. */
  async select (name: string|null = this.activeName): Promise<DeploymentState> {
    if (!name) throw new Error('no deployment selected')
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      this.log.log('activating deployment at', bold(selected.shortPath))
      const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      if (name === this.KEY) name = active.real.name
      name = basename(name, '.yml')
      active.relLink(`${name}.yml`)
      return this.load(name)!
    }
    throw new Error(`deployment ${name} does not exist`)
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
    if (!name) throw new Error('pass deployment name')
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
    for (let [name, data] of Object.entries(state.units!)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new Error("can't save a deployment with no name")
      const receipt: any = new ContractInstance(data).toReceipt()
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

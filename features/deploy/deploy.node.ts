export * from './deploy'

import { bold, timestamp, UploadStore } from '@hackbg/fadroma'
import type { UploadedCode, CodeHash, Name } from '@hackbg/fadroma'
import { SyncFS, FileFormat } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { Deployment, DeployStore } from './deploy'
import type { DeploymentState } from './deploy'

/** Directory containing upload receipts, e.g. `state/$CHAIN/upload`. */
export class JSONFileUploadStore extends UploadStore {
  dir: SyncFS.Directory

  constructor (dir: string|Path) {
    super()
    this.dir = new SyncFS.Directory(dir)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.short??'-'}`
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): UploadedCode|undefined {
    if (typeof codeHash === 'object') {
      codeHash = codeHash.codeHash
    }
    if (!codeHash) {
      throw new Error("can't get upload info: missing code hash")
    }
    const receipt = this.dir.file(`${codeHash!.toLowerCase()}.json`).setFormat(FileFormat.JSON)
    if (receipt.exists()) {
      const uploaded = receipt.load() as { codeId: string }
      if (uploaded.codeId) {
        this.log(
          'loading code id', bold(String(uploaded.codeId)),
          'from', bold(receipt.shortPath)
        )
        super.set(codeHash, uploaded)
      } else {
        this.log.warn('no codeId field found in', bold(receipt.shortPath))
      }
    }
    return super.get(codeHash)
  }

  set (
    codeHash: CodeHash|{ codeHash: CodeHash },
    value: Partial<UploadedCode>
  ): this {
    if (typeof codeHash === 'object') {
      codeHash = codeHash.codeHash
    }
    if (!codeHash) {
      throw new Error("can't set upload info: missing code hash")
    }
    const receipt = this.dir.file(`${codeHash.toLowerCase()}.json`).setFormat(FileFormat.JSON)
    this.log('writing', receipt.shortPath)
    receipt.save(super.get(codeHash)!.serialize())
    return super.set(codeHash, value)
  }
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`. */
export class JSONFileDeployStore extends DeployStore {
  /** Root directory of deploy store. */
  dir: SyncFS.Directory
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (dir: string|Path) {
    super()
    this.dir = new SyncFS.Directory(dir)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.short??'-'}`
  }

  get (name: Name): DeploymentState|undefined {
    const receipt = this.dir.file(`${name}.json`).setFormat(FileFormat.JSON)
    if (receipt.exists()) {
      const state = receipt.load()
      this.log(
        'loading code id',
        bold(name),
        'from',
        bold(receipt.shortPath)
      )
      super.set(name, state)
    }
    return super.get(name)
  }

  set (name: Name, state: Partial<Deployment>|DeploymentState): this {
    if (state instanceof Deployment) state = state.serialize()
    const receipt = new SyncFS.File(this.dir, `${name}.json`).setFormat(FileFormat.JSON)
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
      //const list = this.root.as(Directory).list() ?? []
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
      //const receipt: any = new ContractInstance(data).serialize()
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

export function getUploadStore (path?: string|Path): UploadStore {
  if (path) {
    return new JSONFileUploadStore(path)
  } else {
    return new UploadStore()
  }
}

export function getDeployStore (path?: string): DeployStore {
  if (path) {
    return new JSONFileDeployStore(path)
  } else {
    return new DeployStore()
  }
}

export async function selectDeployment (
  cwd: string|Path, name?: string, store: string|DeployStore = getDeployStore()
): Promise<Deployment> {
  if (typeof store === 'string') {
    store = getDeployStore(store)
  }
  if (!name) {
    if (process.stdout.isTTY) {
      name = await new ProjectPrompter().deployment(store)
    } else {
      throw new Error('pass deployment name')
    }
  }
  const state = store.get(name!)
  if (!state) {
    throw new Error(`no deployment ${name} in store`)
  }
  return Deployment.fromSnapshot(state)
}

export function exportDeployment (
  cwd: string|Path, deployment?: Deployment, path?: string|Path
) {
  if (!deployment) {
    throw new Error("deployment not found")
  }
  if (!path) {
    path = process.cwd()
  }
  // If passed a directory, generate file name
  const exportPath = new SyncFS.Path(path)
  const exportFile = exportPath.isDirectory()
    ? new SyncFS.File(exportPath, `${deployment.name}_@_${timestamp()}.json`)
    : new SyncFS.File(exportPath)
  // Serialize and write the deployment.
  const state = deployment.serialize()
  exportFile.setFormat(FileFormat.JSON).makeParent().save(state)
  console.log(
    'saved', Object.keys(state).length,
    'contracts to', bold(exportFile.short)
  )
}

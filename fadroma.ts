/**
  Fadroma
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

// Reexport everything that's available client side...
export * from './fadroma.browser'

// And more!
import type { ChainId, CodeHash } from '@fadroma/agent'
import { Core, Chain, Program, Deploy, Store } from '@fadroma/agent'
import { getProject, ProjectPrompter } from '@fadroma/create'
import Commands from '@hackbg/cmds'
import { FileFormat } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { SyncFS } from '@hackbg/file'
import { fileURLToPath } from 'node:url'
import { basename } from 'node:path'

const console = new Core.Console('@hackbg/fadroma')

export default function main (...args: any) {
  console.debug('Running main...')
  return new Commands()
    .addCommand(
      { name: 'run', info: 'execute a script', args: 'SCRIPT' },
      (script: string, ...args: string[]) => runScript({ project: getProject(), script, args }))
    .addCommand(
      {name: 'repl', info: 'open an interactive Fadroma shell', args: '' },
      (script: string, ...args: string[]) => runRepl({ project: getProject(), script, args }))
    .addCommand(
      {name: 'status', info: 'show the status of the project', args: '' },
      () => getProject().logStatus())
    .addCommand(
      {name: 'build', info: 'build the project or specific contracts from it', args: '[CONTRACT...]'},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.build({
        compiler: await getCompiler(),
        units
      })))
    .addCommand(
      {name: 'rebuild', info: 'rebuild the project or specific contracts from it', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.build({
        compiler: await getCompiler(),
        units,
        rebuild: true
      })))
    .addCommand(
      {name: 'upload', info: 'upload the project or specific contracts from it', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.upload({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        uploader:    getConnection(),
        units
      })))
    .addCommand(
      {name: 'reupload', info: 'reupload the project or specific contracts from it', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.upload({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        uploader:    getConnection(),
        reupload:    true,
        units,
      })))
    .addCommand(
      {name: 'deploy', info: 'deploy getProject() or continue an interrupted deployment', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.deploy({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        deployStore: getDeployStore(),
        deployer:    getConnection(),
        units
      })))
    .addCommand(
      {name: 'redeploy', info: 'redeploy getProject() from scratch', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.deploy({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        deployStore: getDeployStore(),
        deployer:    getConnection(),
        redeploy:    true,
        units,
      })))
    .addCommand(
      {name: 'select', info: `activate another deployment`, args: ''},
      async (name?: string): Promise<Deploy.Deployment|undefined> => selectDeployment(
        getProject().root,
        name
      ))
    .addCommand(
      {name: 'export', info: `export current deployment to JSON`, args: ''},
      async (path?: string) => exportDeployment(
        getProject().root,
        await getProject().getDeployment(),
        path
      ))
    //.addCommand({name: 'reset', 'stop and erase running devnets',
      //(...ids: ChainId[]) => Devnets.deleteDevnets(
        //getProject().root, ids))
}

//main.prototype.run = (...args: any[]) => console.log(this, args)

type Project = { // FIXME
  root: any
  getDeployment(): Promise<Deploy.Deployment>
  logStatus(): unknown
}

export function getConnection (): Chain.Connection {
  throw new Error('not implemented')
}

export function getCompiler (pkg = "@fadroma/compile"): Promise<Program.Compiler> {
  return import(pkg).catch(e=>{
    console.error(
      "Failed to import @fadroma/compile.\n ",
      "This is the package that compiles the contracts.\n ",
      "You can install it with 'npm i --save @fadroma/compile'"
    )
    throw e
  }).then(compile=>{
    if (process.env.FADROMA_BUILD_NO_CONTAINER) {
      return new compile.RawLocalRustCompiler()
    } else {
      return new compile.ContainerizedLocalRustCompiler()
    }
  })
}

export function getUploadStore (path?: string|Path): Store.UploadStore {
  if (path) {
    return new JSONFileUploadStore(path)
  } else {
    return new Store.UploadStore()
  }
}

export function getDeployStore (path?: string): Store.DeployStore {
  if (path) {
    return new JSONFileDeployStore(path)
  } else {
    return new Store.DeployStore()
  }
}

export async function runScript (context?: { project?: Project, script?: string, args: string[] }) {
  const { project, script, args } = context || {}
  if (!script) {
    throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
  }
  const scriptPath = new SyncFS.Path(script)
  if (!scriptPath.exists()) {
    throw new Error(`${script} doesn't exist`)
  }
  console.log(`Running ${script}`)
  const { default: main } = await import(scriptPath.absolute)
  if (typeof main === 'function') {
    return main(project, ...args||[])
  } else {
    console.error(`The default export of ${Core.bold(scriptPath.short)} is not a function`)
    process.exit(1)
  }
}

export async function runRepl (context?: { project?: Project, script?: string, args: string[] }) {
  const { project, script, args } = context || {}
  let start
  try {
    const repl = await import('node:repl')
    start = repl.start
  } catch (e) {
    console.error('Node REPL unavailable.')
    throw e
  }
  const context2 = start() || project?.getDeployment()
}

export async function selectDeployment (
  cwd: string|Path, name?: string, store: string|Store.DeployStore = getDeployStore()
): Promise<Deploy.Deployment> {
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
  return Deploy.Deployment.fromSnapshot(state)
}

export function exportDeployment (
  cwd: string|Path, deployment?: Deploy.Deployment, path?: string|Path
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
    ? new SyncFS.File(exportPath, `${deployment.name}_@_${Core.timestamp()}.json`)
    : new SyncFS.File(exportPath)
  // Serialize and write the deployment.
  const state = deployment.serialize()
  exportFile.setFormat(FileFormat.JSON).makeParent().save(state)
  console.log(
    'saved', Object.keys(state).length,
    'contracts to', Core.bold(exportFile.short)
  )
}

/** Directory containing upload receipts, e.g. `state/$CHAIN/upload`. */
export class JSONFileUploadStore extends Store.UploadStore {
  dir: SyncFS.Directory

  constructor (dir: string|Path) {
    super()
    this.dir = new SyncFS.Directory(dir)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.short??'-'}`
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): Deploy.UploadedCode|undefined {
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
          'loading code id', Core.bold(String(uploaded.codeId)),
          'from', Core.bold(receipt.shortPath)
        )
        super.set(codeHash, uploaded)
      } else {
        this.log.warn('no codeId field found in', Core.bold(receipt.shortPath))
      }
    }
    return super.get(codeHash)
  }

  set (
    codeHash: CodeHash|{ codeHash: CodeHash },
    value: Partial<Deploy.UploadedCode>
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
export class JSONFileDeployStore extends Store.DeployStore {
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

  get (name: Deploy.Name): Deploy.DeploymentState|undefined {
    const receipt = this.dir.file(`${name}.json`).setFormat(FileFormat.JSON)
    if (receipt.exists()) {
      const state = receipt.load()
      this.log(
        'loading code id',
        Core.bold(name),
        'from',
        Core.bold(receipt.shortPath)
      )
      super.set(name, state)
    }
    return super.get(name)
  }

  set (name: Deploy.Name, state: Partial<Deploy.Deployment>|Deploy.DeploymentState): this {
    if (state instanceof Deploy.Deployment) state = state.serialize()
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

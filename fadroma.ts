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
import type { ChainId, Compiler } from '@fadroma/connect'
import {
  Connection, Console, Error, bold, timestamp, Deployment, CW, Scrt,
  UploadStore, DeployStore, ContractInstance
} from '@fadroma/connect'
import { CommandContext } from '@hackbg/cmds'
import type { CodeHash, UploadedCode, DeploymentState, Name } from '@fadroma/connect'
import $, { Directory, BinaryFile, TextFile, JSONDirectory, JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { fileURLToPath } from 'node:url'
import { basename } from 'node:path'

export * from '@fadroma/connect'

const console = new Console('@hackbg/fadroma')

export default function main (...args: any) {
  return new CommandContext()
    .addCommand('run', 'execute a script',
      (script: string, ...args: string[]) => runScript({ project: getProject(), script, args }))
    .addCommand('repl', 'open an interactive Fadroma shell',
      (script: string, ...args: string[]) => runRepl({ project: getProject(), script, args }))
    .addCommand('status', 'show the status of the project',
      () => getProject().logStatus())
    .addCommand('build', 'build the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.build({
        compiler: getCompiler(), units })))
    .addCommand('rebuild', 'rebuild the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.build({
        compiler: getCompiler(), units, rebuild: true })))
    .addCommand('upload', 'upload the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.upload({
        compiler: getCompiler(), uploadStore: getUploadStore(), uploader: getConnection(),
        units })))
    .addCommand('reupload', 'reupload the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.upload({
        compiler: getCompiler(), uploadStore: getUploadStore(), uploader: getConnection(),
        units, reupload: true })))
    .addCommand('deploy', 'deploy getProject() or continue an interrupted deployment',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.deploy({
        compiler: getCompiler(),
        uploadStore: getUploadStore(), uploader: getConnection(),
        deployStore: getDeployStore(), deployer: getConnection(),
        units })))
    .addCommand('redeploy', 'redeploy getProject() from scratch',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.deploy({
        compiler:    getCompiler(),
        uploadStore: getUploadStore(), uploader: getConnection(),
        deployStore: getDeployStore(), deployer: getConnection(),
        units, redeploy: true })))
    .addCommand('select', `activate another deployment`, 
      async (name?: string): Promise<Deployment|undefined> => selectDeployment(
        getProject().root, name))
    .addCommand('export', `export current deployment to JSON`,
      async (path?: string) => exportDeployment(
        getProject().root, await getProject().getDeployment(), path))
    .addCommand('reset', 'stop and erase running devnets',
      (...ids: ChainId[]) => Devnets.deleteDevnets(
        getProject().root, ids))
}

//main.prototype.run = (...args: any[]) => console.log(this, args)

type Project = any

export function getProject (): Project {
  throw new Error('not implemented')
}

export function getCompiler (): Compiler {
  throw new Error('not implemented')
}

export function getConnection (): Connection {
  throw new Error('not implemented')
}

export async function runScript (context?: { project?: Project, script?: string, args: string[] }) {
  const { project, script, args } = context || {}
  if (!script) {
    throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
  }
  if (!$(script).exists()) {
    throw new Error(`${script} doesn't exist`)
  }
  console.log(`Running ${script}`)
  const path = $(script).path
  //@ts-ignore
  const { default: main } = await import(path)
  if (typeof main === 'function') {
    return main(project, ...args||[])
  } else {
    console.error(`${$(script).shortPath}'s default export is not a function`)
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
  cwd: string|Path, name?: string, store: string|DeployStore = getDeployStore()
): Promise<Deployment> {
  if (typeof store === 'string') {
    store = getDeployStore(store)
  }
  if (!name) {
    if (process.stdout.isTTY) {
      name = await new Tools.ProjectPrompter().deployment(store)
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
  let file = $(path)
  if (file.isDirectory()) {
    file = file.in(`${deployment.name}_@_${timestamp()}.json`)
  }
  // Serialize and write the deployment.
  const state = deployment.serialize()
  file.as(JSONFile).makeParent().save(state)
  console.log(
    'saved', Object.keys(state).length,
    'contracts to', bold(file.shortPath)
  )
}


export function getUploadStore (path?: string|Path): UploadStore {
  if (path) {
    return new JSONFileUploadStore(path)
  } else {
    return new UploadStore()
  }
}

/** Directory containing upload receipts, e.g. `state/$CHAIN/upload`. */
export class JSONFileUploadStore extends UploadStore {
  log = new Console('FSUploadStore')

  dir: JSONDirectory<Partial<UploadedCode>>

  constructor (dir: string|Path) {
    super()
    this.dir = $(dir).as(JSONDirectory<Partial<UploadedCode>>)
  }

  get [Symbol.toStringTag]() {
    return `${this.dir?.shortPath??'-'}`
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): UploadedCode|undefined {
    if (typeof codeHash === 'object') {
      codeHash = codeHash.codeHash
    }
    if (!codeHash) {
      throw new Error("can't get upload info: missing code hash")
    }
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
    if (typeof codeHash === 'object') {
      codeHash = codeHash.codeHash
    }
    if (!codeHash) {
      throw new Error("can't set upload info: missing code hash")
    }
    const receipt = this.dir.at(`${codeHash.toLowerCase()}.json`).as(JSONFile<any>)
    this.log('writing', receipt.shortPath)
    receipt.save(super.get(codeHash)!.serialize())
    return super.set(codeHash, value)
  }
}

export function getDeployStore (path?: string): DeployStore {
  if (path) {
    return new JSONFileDeployStore(path)
  } else {
    return new DeployStore()
  }
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`. */
export class JSONFileDeployStore extends DeployStore {
  log = new Console('DeployStore_v1')
  /** Root directory of deploy store. */
  dir: JSONDirectory<DeploymentState>
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (dir: string|Path) {
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
    if (state instanceof Deployment) state = state.serialize()
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

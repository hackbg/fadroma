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

import type { ChainId, DeployStore } from '@fadroma/connect'
import { Agent, Console, bold, timestamp, Deployment, CW, Scrt } from '@fadroma/connect'
import * as Compilers from './ops/build'
import * as Devnets from './ops/devnets'
import * as Stores from './ops/stores'
import * as Tools from './ops/tools'
import { CommandContext } from '@hackbg/cmds'
import { getProject, createProject, Project } from './ops/project'
import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'

export { Compilers, Devnets, Stores, Tools }
export * from '@fadroma/connect'
export * from './ops/project'

const console = new Console('@hackbg/fadroma')

export default function main (...args: any) {
  return new CommandContext()
    .addCommand('run', 'execute a script',
      (script: string, ...args: string[]) => runScript({ project: getProject(), script, args }))
    .addCommand('repl', 'open an interactive Fadroma shell',
      (script: string, ...args: string[]) => runRepl({ project: getProject(), script, args }))
    .addCommand('status', 'show the status of the project',
      () => getProject().logStatus())
    .addCommand('create', 'create a new project',
      (name: string, crates: string[]) => createProject({ name }))
    .addCommand('build', 'build the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.build({
        compiler: Compilers.getCompiler(),
        units })))
    .addCommand('rebuild', 'rebuild the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.build({
        compiler: Compilers.getCompiler(),
        units, rebuild: true })))
    .addCommand('upload', 'upload the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.upload({
        compiler: Compilers.getCompiler(),
        uploadStore: Stores.getUploadStore(), uploader: getAgent(),
        units })))
    .addCommand('reupload', 'reupload the project or specific contracts from it',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.upload({
        compiler: Compilers.getCompiler(),
        uploadStore: Stores.getUploadStore(), uploader: getAgent(),
        units, reupload: true })))
    .addCommand('deploy', 'deploy getProject() or continue an interrupted deployment',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.deploy({
        compiler: Compilers.getCompiler(),
        uploadStore: Stores.getUploadStore(), uploader: getAgent(),
        deployStore: Stores.getDeployStore(), deployer: getAgent(),
        units })))
    .addCommand('redeploy', 'redeploy getProject() from scratch',
      (...units: string[]) => getProject().getDeployment().then(deployment=>deployment.deploy({
        compiler:    Compilers.getCompiler(),
        uploadStore: Stores.getUploadStore(), uploader: getAgent(),
        deployStore: Stores.getDeployStore(), deployer: getAgent(),
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

export function getAgent (): Agent {
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
  cwd: string|Path, name?: string, store: string|DeployStore = Stores.getDeployStore()
): Promise<Deployment> {
  if (typeof store === 'string') {
    store = Stores.getDeployStore(store)
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

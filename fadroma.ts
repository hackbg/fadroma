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

import type { Agent, ChainId, DeployStore } from '@fadroma/connect'
import { bold, timestamp, Deployment, connectModes, CW, Scrt } from '@fadroma/connect'
import * as Compilers from './ops/build'
import * as Devnets from './ops/devnets'
import * as Prompts from './ops/prompts'
import * as Stores from './ops/stores'
import * as Tools from './ops/tools'
import { CommandContext } from '@hackbg/cmds'
import { Project } from './ops/project'
import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'

export { Compilers, Devnets, Prompts, Stores, Tools, }
export * from '@fadroma/connect'
export * from './ops/project'

export class ProjectCommands extends CommandContext {
  constructor (
    readonly project: Project = new Project('project', process.env.FADROMA_PROJECT || process.cwd())
  ) {
    super()
    this
      .addCommand(
        'run', 'execute a script',
        (script: string, ...args: string[]) => runScript({ project: this.project, script, args }))
      .addCommand(
        'repl', 'open a project REPL (optionally executing a script first)',
        (script: string, ...args: string[]) => runRepl({ project: this.project, script, args }))
      .addCommand(
        'status', 'show the status of the project',
        () => Prompts.logProjectStatus(this.getProject()))
      .addCommand(
        'create', 'create a new project',
        Project.create)

    if (this.project) {
      this
        .addCommand('build', 'build the project or specific contracts from it',
          (...names: string[]) => this.getProject().getDeployment().build({
            compiler: Compilers.getCompiler(), }))
        .addCommand('rebuild', 'rebuild the project or specific contracts from it',
          (...names: string[]) => this.getProject().getDeployment().build({
            rebuild: true,
            compiler: Compilers.getCompiler(), }))
        .addCommand('upload', 'upload the project or specific contracts from it',
          (...names: string[]) => this.getProject().getDeployment().upload({
            compiler: Compilers.getCompiler(),
            uploadStore: Stores.getUploadStore(), uploader: this.getAgent(), }))
        .addCommand('reupload', 'reupload the project or specific contracts from it',
          (...names: string[]) => this.getProject().getDeployment().upload({
            compiler: Compilers.getCompiler(),
            uploadStore: Stores.getUploadStore(), uploader: this.getAgent(), reupload: true }))
        .addCommand('deploy', 'deploy this project or continue an interrupted deployment',
          (...args: string[]) => this.getProject().getDeployment().deploy({
            compiler: Compilers.getCompiler(),
            uploadStore: Stores.getUploadStore(), uploader: this.getAgent(),
            deployStore: Stores.getDeployStore(), deployer: this.getAgent(),
            deployment:  this.getProject().getDeployment() }))
        .addCommand('redeploy', 'redeploy this project from scratch',
          (...args: string[]) => this.getProject().getDeployment().deploy({
            compiler:    Compilers.getCompiler(),
            uploadStore: Stores.getUploadStore(), uploader: this.getAgent(),
            deployStore: Stores.getDeployStore(), deployer: this.getAgent(),
            deployment:  this.getProject().createDeployment() }))
        .addCommand('select', `activate another deployment`, 
          async (name?: string): Promise<Deployment|undefined> => selectDeployment(
            this.project.root, name))
        .addCommand('export', `export current deployment to JSON`,
          async (path?: string) => exportDeployment(
            this.project.root, await this.getProject().getDeployment(), path))
        .addCommand('reset', 'stop and erase running devnets',
          (...ids: ChainId[]) => Devnets.Container.resetAll(
            this.project.root, ids))
    }
  }

  getProject (): Project {
    return new Project('name_from_package_json', this.root)
  }

  getAgent (): Agent {
  }
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
      name = await Prompts.askDeployment(store)
    } else {
      throw new Error('pass deployment name')
    }
  }
  const state = store.get(name!)
  if (!state) {
    throw new Error(`no deployment ${name} in store`)
  }
  return Deployment.fromReceipt(state)
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
    file = file.in(`${name}_@_${timestamp()}.json`)
  }
  // Serialize and write the deployment.
  const state = deployment.toReceipt()
  file.as(JSONFile).makeParent().save(state)
  console.info(
    'saved',
    Object.keys(state).length,
    'contracts to',
    bold(file.shortPath)
  )
}

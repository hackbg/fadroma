import type { Path } from '@hackbg/file'
import { FileFormat, SyncFS } from '@hackbg/file'
import Commands from '@hackbg/cmds'
import type { ChainId, Connection, Agent } from '@hackbg/fadroma'
import { bold } from '@hackbg/fadroma'
import { getProject, ProjectPrompter } from '@fadroma/create'
import { getCompiler } from '@fadroma/compile'
import {
  getUploadStore, getDeployStore, Deployment, selectDeployment, exportDeployment
} from '@fadroma/deploy'

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
        uploader:    getAgent(),
        units
      })))
    .addCommand(
      {name: 'reupload', info: 'reupload the project or specific contracts from it', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.upload({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        uploader:    getAgent(),
        reupload:    true,
        units,
      })))
    .addCommand(
      {name: 'deploy', info: 'deploy getProject() or continue an interrupted deployment', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.deploy({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        deployStore: getDeployStore(),
        deployer:    getAgent(),
        units
      })))
    .addCommand(
      {name: 'redeploy', info: 'redeploy getProject() from scratch', args: ''},
      (...units: string[]) => getProject().getDeployment().then(async deployment=>deployment.deploy({
        compiler:    await getCompiler(),
        uploadStore: getUploadStore(),
        deployStore: getDeployStore(),
        deployer:    getAgent(),
        redeploy:    true,
        units,
      })))
    .addCommand(
      {name: 'select', info: `activate another deployment`, args: ''},
      async (name?: string): Promise<Deployment|undefined> => selectDeployment(
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
    console.error(`The default export of ${bold(scriptPath.short)} is not a function`)
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

export function getConnection (): Connection {
  throw new Error('not implemented')
}

export function getAgent (): Agent {
  throw new Error('not implemented')
}

interface Project { // FIXME
  root: any
  getDeployment(): Promise<Deployment>
  logStatus(): unknown
}

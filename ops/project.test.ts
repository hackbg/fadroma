/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import {
  ProjectCommands,
  Deployment, UploadedCode, ContractTemplate, ContractInstance, Stub
} from '@hackbg/fadroma'
import { JSONFileDeployStore } from './stores'
import { getCompiler } from './build'
import { fixture, tmpDir } from '../fixtures/fixtures'
import * as Projects from './project'
import { withTmpDir } from '@hackbg/file'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ["commands",   testProjectCommands],
  ["wizard",     testProjectWizard],
  ['deployment', testDeployment],
])

export async function testProjectCommands () {
  const scriptProject =
    await Projects.ScriptProject.create({
      name: 'test-script-project',
      root: `${tmpDir()}/test-script-project`
    })
  const crateProject =
    await Projects.CrateProject.create({
      name: 'test-crate-project',
      root: `${tmpDir()}/test-crate-project`
    })
  const workspaceProject =
    await Projects.WorkspaceProject.create({
      name: 'test-workspace-project',
      root: `${tmpDir()}/test-workspace-project`
    })

  for (const project of [scriptProject, crateProject, workspaceProject]) {
    const commands = new ProjectCommands(project)
    commands.run(['status'])
    await commands.run(['build'])
    await commands.run(['rebuild', 'test1'])
    await commands.run(['upload'])
    await commands.run(['reupload', 'test1'])
    await commands.run(['deploy'])
    await commands.run(['redeploy', 'test1'])
    await commands.run(['export'])
  }
}

export async function testProjectWizard () {
  //const wizard = new ProjectWizard({
    //interactive: false,
    //cwd: tmpDir()
  //})
  //assert.ok(await wizard.createProject(
    //Project,
    //'test-project-2',
    //'test3',
    //'test4'
  //) instanceof Project)
}

//export function tmpDir () {
  //let x
  //withTmpDir(dir=>x=dir)
  //return x
//}

//export new DeploymentBuilder('mydeployment')
  //.template('swapPool', { codeId: '1', crate: 'examples/kv' })
  //.contract('swapFactory', {
    //codeId: '2', crate: 'examples/kv', label: 'swap factory', async initMsg () {
      //const pool = await this('swapPool').upload()
      //return { pool: { id: pool.codeId, hash: pool.codeHash } }
    //}
  //})
  //.contracts('swap/', { codeId: '2', crate: 'examples/kv' }, {
    //'a': { label: 'foo', initMsg: {} },
    //'b': { label: 'foo', initMsg: {} },
  //})
  //.command()

export class MyDeployment extends Deployment {
  t = this.template('t', { codeId: '1', sourcePath: fixture("../examples/kv") })

  // Single template instance with eager and lazy initMsg
  a1 = this.t.contract('a1', { initMsg: {} })
  a2 = this.t.contract('a2', { initMsg: () => ({}) })
  a3 = this.t.contract('a3', { initMsg: async () => ({}) })

  // Multiple contracts from the same template
  b = this.t.contracts({
    b1: { initMsg: {} },
    b2: { initMsg: () => ({}) },
    b3: { initMsg: async () => ({}) }
  })
}

export async function testDeployment () {
  const deployment = new MyDeployment()
  assert.ok(deployment.t instanceof ContractTemplate)
  await deployment.deploy({
    uploader: new Stub.Agent(),
    deployer: new Stub.Agent(),
  })
  assert.ok([deployment.a1, deployment.a2, deployment.a3, ...Object.values(deployment.b)].every(
    c=>c instanceof ContractInstance
  ))
}

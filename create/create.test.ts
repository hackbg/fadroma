/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import type { ChainId } from '@fadroma/agent'
import { Core, Deploy, Stub } from '@fadroma/agent'
const { Error, bold, timestamp, bip39, bip39EN } = Core
const { Deployment, ContractCode } = Deploy

import { tmpDir, TestProjectDeployment } from '@fadroma/fixtures'
import * as Projects from './create'
import { withTmpDir } from '@hackbg/file'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ["commands",   testProjectCommands],
  ["create",     testProjectCreate],
  ['deployment', testDeployment],
])

export async function testProjectCommands () {
  //await projectMain()

  //for (const project of [
    //await Projects.ScriptProject.create({
      //name: 'test-script-project',
      //root: `${tmpDir()}/test-script-project`,
      //interactive: false
    //}),
    //await Projects.CrateProject.create({
      //name: 'test-crate-project',
      //root: `${tmpDir()}/test-crate-project`,
      //interactive: false
    //}),
    //await Projects.WorkspaceProject.create({
      //name: 'test-workspace-project',
      //root: `${tmpDir()}/test-workspace-project`,
      //interactive: false
    //})
  //]) {
    //const commands = new ProjectCommands(project)
    //commands.run(['status'])
    //await commands.run(['build'])
    //await commands.run(['rebuild', 'test1'])
    //await commands.run(['upload'])
    //await commands.run(['reupload', 'test1'])
    //await commands.run(['deploy'])
    //await commands.run(['redeploy', 'test1'])
    //await commands.run(['export'])
  //}
}

export async function testProjectCreate () {
  await withTmpDir(async root=>{
    Projects.createProject({
      name: 'test-project-1',
      root,
      interactive: false
    })

    const project = Projects.getProject(root)

    await project.logStatus()

    //project.getDeployment()
  })

  //const create = new ProjectCreate({
    //interactive: false,
    //cwd: tmpDir()
  //})
  //assert.ok(await create.createProject(
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

export async function testDeployment () {
  const deployment = new TestProjectDeployment()
  assert.ok(deployment.t instanceof Deploy.ContractTemplate)
  await deployment.deploy({
    uploader: new Stub.StubConnection(),
    deployer: new Stub.StubConnection(),
  })
  assert.ok([deployment.a1, deployment.a2, deployment.a3, ...Object.values(deployment.b)].every(
    c=>c instanceof Deploy.ContractInstance
  ))
}

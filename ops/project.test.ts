/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import {
  Deployment, UploadedCode, ContractTemplate, ContractInstance, Stub
} from '@fadroma/connect'
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
  ['upgrade',    testDeploymentUpgrade],
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
    const commands = new Projects.ProjectCommands(project)
  }

  for (const [name, Project] of [
    [],
    [],
  ]) {
  const root = `${tmpDir()}/test-project-1`
  const name = 'test-project-1'
  const project = Project.create({ root, name })

  project.status()
  project.cargoUpdate()

  await project.build()
  await project.build('test1')

  await project.upload()
  await project.upload('test1')

  await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
  await project.redeploy(/* ... */)
  await project.exportDeployment('state')
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

export async function testDeploymentUpgrade () {

  class V1Deployment extends Deployment {
    kv1 = this.contract('kv1', {
      sourcePath: fixture("../examples/kv"),
      initMsg: {}
    })
    kv2 = this.contract('kv2', {
      sourcePath: fixture("../examples/kv"),
      initMsg: {}
    })
  }

  let deployment = new V1Deployment()
  assert.deepEqual([...deployment.keys()], ['kv1', 'kv2'])
  const mainnetAgent: any = { chain: { isMainnet: true } } // mock
  const testnetAgent: any = { chain: { isTestnet: true } } // mock

  // simplest chain-side migration is to just call default deploy,
  // which should reuse kv1 and kv2 and only deploy kv3.

  class V2Deployment extends V1Deployment {
    kv3 = this.contract('kv3', {
      sourcePath: fixture("../examples/kv"),
      initMsg: {}
    })
    // simplest client-side migration is to just instantiate
    // a new deployment with the data from the old deployment.
    static upgrade = (previous: V1Deployment) => new this({
      ...previous
    })
  }
  let deployment2 = await V2Deployment.upgrade(deployment).deploy({
    compiler: getCompiler(),
    uploader: new Stub.Agent(),
    deployer: new Stub.Agent(),
  })
}

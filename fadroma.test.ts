import * as assert from 'node:assert'

import $, { OpaqueDirectory, withTmpDir } from '@hackbg/file'
import * as Dock from '@hackbg/dock'

import type { Agent } from '@fadroma/agent'
import {
  Deployment, DeployStore, Builder,
  into, intoArray, intoRecord,
  StubAgent, UploadStore
} from '@fadroma/agent'

import {
  Project,
  getAgent,
  getDeployment, FSDeployStore,
  getBuilder, BuildContainer, BuildRaw,
  upload,
  getGitDir, DotGit,
  DeployConsole,
  ContractTemplate,
  ContractInstance,
  ContractClient
} from '@hackbg/fadroma'

import { ProjectWizard } from './ops/wizard'

import { fixture } from './fixtures/fixtures'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['agent',        () => import('./agent/agent.test')],
  ['connect',      () => import('./connect/connect.test')],
  ['devnet',       () => import('./ops/devnet.test')],
  ['wizard',       testProjectWizard],
  //['project',      testProject],
  ['deployment',   testDeployment],
  ['deploy-store', testDeployStore],
  ['build',        testBuild],
  ['upload',       testUpload],
  ['upload-store', testUploadStore],
  //['factory', () => import ('./Factory.spec.ts.md')],
  //['impl',    () => import('./Implementing.spec.ts.md')],
  ['collections',  testCollections],
  ['consoles',     testConsoles]
])

export async function testProject () {
  const { Project } = await import('@hackbg/fadroma')
  const { tmpDir } = await import('./fixtures/fixtures')
  const root = tmpDir()
  let project: Project = new Project({
    root: `${root}/test-project-1`,
    name: 'test-project-1',
    templates: {
      test1: { crate: 'test1' },
      test2: { crate: 'test2' },
    }
  })
    .create()
    .status()
    .cargoUpdate()
  const test1 = project.getTemplate('test1')
  assert.ok(test1 instanceof ContractTemplate)
  const test3 = project.setTemplate('test3', { crate: 'test2' })
  assert.ok(test3 instanceof ContractTemplate)
  await project.build()
  await project.build('test1')
  await project.upload()
  await project.upload('test1')
  await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
  await project.redeploy(/* ... */)
  await project.exportDeployment('state')
}

class MyDeployment extends Deployment {
  t = this.template({ crate: 'examples/kv' })
  // Single template instance with eager and lazy initMsg
  a1 = this.t.instance({ name: 'a1', initMsg: {} })
  a2 = this.t.instance({ name: 'a2', initMsg: () => {} })
  a3 = this.t.instance({ name: 'a3', initMsg: async () => {} })
  // Multiple template instances as array
  // with varying initMsg eagerness
  b = this.t.instances([
    { name: 'b1', initMsg: {} },
    { name: 'b2', initMsg: ()=>{} },
    { name: 'b3', initMsg: async ()=>{} }
  ])
  // Multiple template instances as object
  // with varying initMsg eagerness
  // (named automatically)
  c = this.t.instances({
    c1: { initMsg: {} },
    c2: { initMsg: () => {} },
    c3: { initMsg: async () => {} }
  })
}

export async function testDeployment () {
  const deployment = new MyDeployment()
  assert.ok(deployment.t instanceof ContractTemplate)
  await deployment.deploy()
  assert.ok([
    deployment.a,
    ...Object.values(deployment.b),
    ...Object.values(deployment.c),
  ].every(
    c=>(c instanceof ContractInstance) && (c.expect() instanceof Client)
  ))
}

export async function testBuild () {
  const deployment = new MyDeployment()
  await deployment.build({ builder: getBuilder() })
  const builder = getBuilder(/* { ...options... } */)
  assert.ok(builder instanceof Builder)

  //assert.ok(getBuilder({ raw: false }) instanceof BuildContainer)
  //assert.ok(getBuilder({ raw: false }).docker instanceof Dock.Engine)
  //getBuilder({ raw: false, dockerSocket: 'test' })
  //const rawBuilder = getBuilder({ raw: true })
  //assert.ok(rawBuilder instanceof BuildRaw)
  //for (const raw of [true, false]) {
    //const builder = getBuilder({ raw })
    //const contract_0 = await builder.build({ crate: 'examples/kv' })
    //const [contract_1, contract_2] = await builder.buildMany([
      //{ crate: 'examples/admin' },
      //{ crate: 'examples/killswitch' }
    //])
    //for (const [contract, index] of [ contract_0, contract_1, contract_2 ].map((c,i)=>[c,i]) {
      //assert.ok(typeof contract.codeHash === 'string', `contract_${index}.codeHash is set`)
      //assert.ok(contract.artifact instanceof URL,      `contract_${index}.artifact is set`)
      //assert.ok(contract.workspace, `contract_${index}.workspace is set`)
      //assert.ok(contract.crate,     `contract_${index}.crate is set`)
      //assert.ok(contract.revision,  `contract_${index}.revision is set`)
    //}
  //}
  //const contract: Contract<any> = new Contract({ builder, crate: 'fadroma-example-kv' })
  //const template = new Template({ builder, crate: 'fadroma-example-kv' })
  //await template.compiled
}

export async function testBuildHistory () {
  assert.throws(()=>getGitDir(new ContractInstance()))
  const contractWithSource = new ContractInstance({
    repository: 'REPO',
    revision:   'REF',
    workspace:  'WORKSPACE',
    crate:      'CRATE'
  })
  assert.ok(getGitDir(contractWithSource) instanceof DotGit)
}

export async function testUpload () {
  const deployment = new MyDeployment()
  await deployment.upload({
    agent: new StubAgent(),
    uploadStore: new UploadStore('')
  })
}

export async function testDeploymentUpgrade () {
  class V1Deployment extends Deployment {
    kv1 = this.contract('kv1', { crate: 'examples/kv', initMsg: {} })
    kv2 = this.contract('kv2', { crate: 'examples/kv', initMsg: {} })
  }
  class V2Deployment extends V1Deployment {
    kv3 = this.contract('kv3', { crate: 'examples/kv', initMsg: {} })
    // simplest client-side migration is to just instantiate
    // a new deployment with the data from the old deployment.
    static upgrade = (previous: V1Deployment) => new this({
      ...previous
    })
  }
  let deployment = new V1Deployment()
  assert.deepEqual(deployment.contracts.keys(), ['kv1', 'kv2'])
  const mainnetAgent: any = { chain: { isMainnet: true } } // mock
  const testnetAgent: any = { chain: { isTestnet: true } } // mock
  // simplest chain-side migration is to just call default deploy,
  // which should reuse kv1 and kv2 and only deploy kv3.
  let deployment2 = await V2Deployment.upgrade(deployment).deploy({
    agent: new StubAgent()
  })
}

export async function testDeployStore () {

  new class MyDeployStore extends DeployStore {
    list (): string[] { throw 'stub' }
    save () { throw 'stub' }
    load () { return { foo: {}, bar: {} } }
    create (x: any): any { throw 'stub' }
    select (x: any): any { throw 'stub' }
    get active (): any { throw 'stub' }
    get activeName (): any { throw 'stub' }
  }().getDeployment(class extends Deployment {
    foo = this.contract({ name: 'foo' })
    bar = this.contract({ name: 'bar' })
  })

  let result = ''
  const store = new FSDeployStore('', {})

  Object.defineProperty(store, 'root', { // mock
    value: {
      exists: () => false,
      make: () => ({}),
      at: () => ({
        real: { name: 'foobar' },
        exists: () => false,
        as: () => ({
          save: (output: any)=>{result=output},
          loadAll: () => [ {name: 'foo'}, {name: 'bar'} ],
        }),
        makeParent: () => ({
          exists: () => false,
          as: () => ({ save: (output: any)=>{result=output} })
        }),
      })
    }
  })

  await store.create()

  store.list()

  //store.save('foo', { contract1: { deployment: true }, contract2: { deployment: true } } as any)

  //assert.equal(result, '---\n{}\n---\n{}\n')
  assert.ok(store[Symbol.toStringTag])
}

export async function testUploadStore () {
  let uploader: FSUploader
  let agent:    Agent = { chain: { id: 'testing' }, upload: async (x: any) => x } as any // mock

  //await withTmpDir(async store=>{
    //uploader = new FSUploader({ agent, store })
    //assert.ok(uploader.agent === agent)
    //assert.ok(await uploader.upload(template))
    //assert.ok(await uploader.upload(template))
    //assert.ok(await uploader.uploadMany([template]))
  //})
}

export function tmpDir () {
  let x
  withTmpDir(dir=>x=dir)
  return x
}

export async function testProjectWizard () {

  const wizard = new ProjectWizard({
    interactive: false,
    cwd: tmpDir()
  })

  assert.ok(await wizard.createProject(
    Project,
    'test-project-2',
    'test3',
    'test4'
  ) instanceof Project)

}

export async function testCollections () {

  assert.equal(await into(1), 1)
  assert.equal(await into(Promise.resolve(1)), 1)
  assert.equal(await into(()=>1), 1)
  assert.equal(await into(async ()=>1), 1)

  assert.deepEqual(
    await intoArray([1, ()=>1, Promise.resolve(1), async () => 1]),
    [1, 1, 1, 1]
  )

  assert.deepEqual(await intoRecord({
    ready:   1,
    getter:  () => 2,
    promise: Promise.resolve(3),
    asyncFn: async () => 4
  }), {
    ready:   1,
    getter:  2,
    promise: 3,
    asyncFn: 4
  })
}

export function testConsoles () {

  new DeployConsole('test message')
    .activating('asdf')
    .noAgent('name')
    .list('asdf', new FSDeployStore('', {}))

}

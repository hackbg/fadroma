import * as assert from 'node:assert'
import {
  Template, Contract, Client, Deployment, DeployStore, Builder, Uploader,
  into, intoArray, intoRecord
} from '@fadroma/agent'
import Project, {
  getDeployment, DeployStore_v1,
  getBuilder, BuildContainer, BuildRaw,
  FSUploader, upload, getUploader,
  getGitDir, DotGit,
} from '@hackbg/fadroma'
import { ProjectWizard } from './fadroma-wizard'
import type { Agent } from '@fadroma/agent'
import $, { OpaqueDirectory, withTmpDir } from '@hackbg/file'
import * as Dock from '@hackbg/dock'
import { fixture } from './fixtures/fixtures'

import { TestSuite } from '@hackbg/ensuite'

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

export async function testProject () {
  const { default: Project } = await import('@hackbg/fadroma')
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
  assert.ok(test1 instanceof Template)

  const test3 = project.setTemplate('test3', { crate: 'test2' })
  assert.ok(test3 instanceof Template)
  await project.build()
  await project.build('test1')
  await project.upload()
  await project.upload('test2')
  await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
  await project.redeploy(/* ... */)
  await project.exportDeployment('state')
}

class MyDeployment extends Deployment {
  t = this.template({ crate: 'examples/kv' })
  a = this.t.instance({ name: 'a', initMsg: {} })
  b = this.t.instances([
    {name:'b1',initMsg:{}}, {name:'b2',initMsg:{}}, {name:'b3',initMsg:{}}
  ])
  c = this.t.instances({
    c1:{name:'c1',initMsg:{}}, c2:{name:'c2',initMsg:{}}, c3:{name:'c3',initMsg:{}}
  })
}

export async function testDeployment () {
  let deployment = await getDeployment(MyDeployment).deploy()
  assert.ok(deployment.t instanceof Template)
  assert.ok([
    deployment.a,
    ...Object.values(deployment.b),
    ...Object.values(deployment.c),
  ].every(
    c=>(c instanceof Contract) && (c.expect() instanceof Client)
  ))
}

export async function testBuild () {
  const deployment = getDeployment(MyDeployment)
  assert.ok(deployment.t.builder instanceof Builder)
  assert.equal(deployment.t.builder, deployment.builder)
  await deployment.t.built
  // -or-
  await deployment.t.build()
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
  assert.throws(()=>getGitDir(new Contract()))
  const contractWithSource = new Contract({
    repository: 'REPO',
    revision:   'REF',
    workspace:  'WORKSPACE',
    crate:      'CRATE'
  })
  assert.ok(getGitDir(contractWithSource) instanceof DotGit)
}

export async function testUpload () {
  const deployment = getDeployment(MyDeployment)
  assert.ok(deployment.t.uploader instanceof Uploader)
  assert.equal(deployment.t.uploader, deployment.uploader)
  await deployment.t.uploaded
  // -or-
  await deployment.t.upload()
  const artifact = fixture('fadroma-example-kv@HEAD.wasm') // replace with path to your binary
  await upload({ artifact })
  await getUploader({ /* options */ }).upload({ artifact })
}

export async function testDeploymentUpgrade () {
  // and create instances of your deployment with preloaded
  // "address books" of contracts. for example here we restore
  // a different snapshot depending on whether we're passed a
  // mainnet or testnet connection.
  class MyDeployment_v1 extends Deployment {
    kv1 = this.contract({ crate: 'examples/kv', name: 'kv1', initMsg: {} })
    kv2 = this.contract({ crate: 'examples/kv', name: 'kv2', initMsg: {} })
    static connect = (agent: Agent) => {
      if (agent?.chain?.isMainnet) return new this({ ...mainnet, agent })
      if (agent?.chain?.isTestnet) return new this({ ...testnet, agent })
      return new this({ agent })
    }
  }
  class MyDeployment_v2 extends MyDeployment_v1 {
    kv3 = this.contract({ crate: 'examples/kv', name: 'kv3', initMsg: {} })
    // simplest client-side migration is to just instantiate
    // a new deployment with the data from the old deployment.
    static upgrade = (previous: MyDeployment_v1) => new this({ ...previous })
  }
  let deployment = new MyDeployment_v1()
  assert.deepEqual(Object.keys(deployment.snapshot.contracts), ['kv1', 'kv2'])
  // you would load snapshots as JSON, e.g.:
  // const testnet = await (await fetch('./testnet_v4.json')).json()
  const mainnet = deployment.snapshot
  const testnet = deployment.snapshot
  const mainnetAgent: any = { chain: { isMainnet: true } } // mock
  const testnetAgent: any = { chain: { isTestnet: true } } // mock
  const onMainnet = MyDeployment_v1.connect(mainnetAgent)
  const onTestnet = MyDeployment_v1.connect(testnetAgent)
  assert.ok(onMainnet.isMainnet)
  assert.ok(onTestnet.isTestnet)
  assert.deepEqual(Object.keys(onMainnet.contracts), ['kv1', 'kv2'])
  assert.deepEqual(Object.keys(onTestnet.contracts), ['kv1', 'kv2'])
  const kv1 = MyDeployment_v1.connect(mainnetAgent).kv1.expect()
  assert.ok(kv1 instanceof Client)
  const kv2 = MyDeployment_v1.connect(testnetAgent).kv2.expect()
  assert.ok(kv2 instanceof Client)
  // simplest chain-side migration is to just call default deploy,
  // which should reuse kv1 and kv2 and only deploy kv3.
  deployment = await MyDeployment_v2.upgrade(deployment).deploy()
}

export async function testDeployStore () {
  new class MyDeployStore extends DeployStore {
    list (): string[] { throw 'stub' }
    save () { throw 'stub' }
    create (x: any): any { throw 'stub' }
    select (x: any): any { throw 'stub' }
    get active (): any { throw 'stub' }
    get activeName (): any { throw 'stub' }

    load () { return { foo: {}, bar: {} } }
  }().getDeployment(class extends Deployment {
    foo = this.contract({ name: 'foo' })
    bar = this.contract({ name: 'bar' })
  })

  let result = ''
  const store = new DeployStore_v1('', {})
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
  store.save('foo', { contract1: { deployment: true }, contract2: { deployment: true } } as any)
  assert.equal(result, '---\n{}\n---\n{}\n')
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
  assert.ok(await new ProjectWizard({ interactive: false, cwd: tmpDir() }).createProject(
    Project,
    'test-project-2',
    'test3',
    'test4'
  ) instanceof Project)
}

export default new TestSuite(import.meta.url, [
  ['agent',        () => import('./agent/agent.test')],
  ['connect',      () => import('./connect/connect.test')],
  ['cw',           () => import('./connect/cw/cw.test')],
  ['scrt',         () => import('./connect/scrt/scrt.test')],
  ['devnet',       () => import('./fadroma-devnet.test')],
  ['wizard',       testProjectWizard],
  ['collections',  testCollections],
  //['project',      testProject],
  ['deployment',   testDeployment],
  ['deploy-store', testDeployStore],
  ['build',        testBuild],
  ['upload',       testUpload],
  ['upload-store', testUploadStore],
  //['factory', () => import ('./Factory.spec.ts.md')],
  //['impl',    () => import('./Implementing.spec.ts.md')],
])

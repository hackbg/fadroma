import * as assert from 'node:assert'
import {
  Template, Contract, Client, Deployment, Builder, Uploader, into, intoArray, intoRecord
} from '@fadroma/agent'
import Project, { getDeployment } from '@hackbg/fadroma'
import type { Agent } from '@fadroma/agent'
import $, { OpaqueDirectory } from '@hackbg/file'

import { testEntrypoint, testSuite } from '@hackbg/ensuite'

export default testEntrypoint(import.meta.url, {

  'agent':   testSuite('./agent/agent.test'),

  'connect': testSuite('./connect/connect.test'),
  'cw':      testSuite('./connect/cw/cw.test'),
  'scrt':    testSuite('./connect/scrt/scrt.test'),

  'build':   testSuite('./fadroma-build.test'),
  'deploy':  testSuite('./fadroma-deploy.test'),
  'devnet':  testSuite('./fadroma-devnet.test'),
  'upload':  testSuite('./fadroma-upload.test'),
  'wizard':  testSuite('./fadroma-wizard.test'),

  //'factory': () => import ('./Factory.spec.ts.md'),
  //'impl':    () => import('./Implementing.spec.ts.md'),
})

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
  assert(test1 instanceof Template)

  const test3 = project.setTemplate('test3', { crate: 'test2' })
  assert(test3 instanceof Template)
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
  assert(deployment.t instanceof Template)
  assert([
    deployment.a,
    ...Object.values(deployment.b),
    ...Object.values(deployment.c),
  ].every(
    c=>(c instanceof Contract) && (c.expect() instanceof Client)
  ))
}

export async function testBuild () {
  const deployment = new MyDeployment()
  assert(deployment.t.builder instanceof Builder)
  assert.equal(deployment.t.builder, deployment.builder)
  await deployment.t.built
  // -or-
  await deployment.t.build()
}

export async function testUpload () {
  const deployment = new MyDeployment()
  assert(deployment.t.uploader instanceof Uploader)
  assert.equal(deployment.t.uploader, deployment.uploader)
  await deployment.t.uploaded
  // -or-
  await deployment.t.upload()
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
  assert(onMainnet.isMainnet)
  assert(onTestnet.isTestnet)
  assert.deepEqual(Object.keys(onMainnet.contracts), ['kv1', 'kv2'])
  assert.deepEqual(Object.keys(onTestnet.contracts), ['kv1', 'kv2'])
  const kv1 = MyDeployment_v1.connect(mainnetAgent).kv1.expect()
  assert(kv1 instanceof Client)
  const kv2 = MyDeployment_v1.connect(testnetAgent).kv2.expect()
  assert(kv2 instanceof Client)
  // simplest chain-side migration is to just call default deploy,
  // which should reuse kv1 and kv2 and only deploy kv3.
  deployment = await MyDeployment_v2.upgrade(deployment).deploy()

}

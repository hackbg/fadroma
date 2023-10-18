import * as assert from 'node:assert'
import { into, intoArray, intoRecord } from '@fadroma/agent'
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
  const { tmpDir } = await import('./fixtures/Fixtures.ts.md')

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

export async function testDeploy () {
import { Deployment, Template, Contract, Client } from '@fadroma/agent'
let deployment: Deployment
let template:   Template
let contract:   Contract
}

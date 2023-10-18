import { Chain, StubAgent as Agent, Batch, Error, Console } from '@fadroma/agent'
import assert from 'node:assert'

import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs':    () => import('./Agent.spec.ts.md'),
  'batch':   testAgentBatch,
  'errors':  testAgentErrors,
  'console': testAgentConsole,
})

export async function testAgentBatch () {

  let chain: Chain = Chain.mocknet()
  let agent: Agent = await chain.getAgent({ address: 'testing1agent0' })
  let batch: Batch

  class TestBatch extends Batch {
    async submit () { return 'submitted' }
    async save   () { return 'saved' }
  }

  assert.equal(await new TestBatch(agent, async batch=>{
    assert(batch instanceof TestBatch)
  }).run(), 'submitted')

  assert.equal(await new TestBatch(agent, async batch=>{
    assert(batch instanceof TestBatch)
  }).save(), 'saved')

  batch = new TestBatch(agent)
  assert.deepEqual(batch.msgs, [])
  assert.equal(batch.id, 0)
  assert.throws(()=>batch.assertMessages())

  batch.add({})
  assert.deepEqual(batch.msgs, [{}])
  assert.equal(batch.id, 1)
  assert.ok(batch.assertMessages())

  batch = new TestBatch(agent)
  assert.equal(await batch.run(""),       "submitted")
  assert.equal(await batch.run("", true), "saved")
  assert.equal(batch.depth, 0)

  batch = batch.batch()
  assert.equal(batch.depth, 1)
  assert.equal(await batch.run(), null)

  agent = new class TestAgent extends Agent { Batch = class TestBatch extends Batch {} }
  batch = agent.batch()
  assert(batch instanceof Batch)

  agent = new class TestAgent extends Agent { Batch = class TestBatch extends Batch {} }
  //await agent.instantiateMany(new Contract(), [])
  //await agent.instantiateMany(new Contract(), [], 'prefix')

  /***
  ## Introductory example

  FIXME: add to spec (fix imports)

  ```typescript
  import { Scrt } from '@hackbg/fadroma'
  import { ExampleContract } from '@example/project'

  export default async function main () {
    const chain    = new Scrt()
    const agent    = await chain.getAgent().ready
    const address  = "secret1..."
    const contract = new Client({ agent, address: "secret1..." })
    const response = await contract.myQuery()
    const result   = await contract.myTransaction()
    return result
  }
  ```
  *///
}

export async function testAgentErrors () {
  // Make sure each error subclass can be created with no arguments:
  for (const key of Object.keys(Error)) {
    const subtype = Error[key as keyof typeof Error] as any
    if (typeof subtype ==='function') assert(new subtype() instanceof Error, `error ${key}`)
  }
}

export async function testAgentConsole () {
  // Make sure each log message can be created with no arguments:
  const log = new Console()
  for (const key of Object.keys(log)) {
    const method = log[key as keyof typeof log] as any
    if (typeof method==='function') try { method.bind(log)() } catch (e) { console.warn(e) }
  }
}

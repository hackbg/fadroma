import { StubChain as Chain, StubAgent as Agent, Batch, Error, Console } from './agent'
import assert from 'node:assert'

import { testEntrypoint, testSuite } from '@hackbg/ensuite'
export default testEntrypoint(import.meta.url, {
  'obtain':  testAgentObtain,
  'batch':   testAgentBatch,
  'errors':  testAgentErrors,
  'console': testAgentConsole,
})

export async function testAgentObtain () {
  const chain = new Chain()
  let agent: Agent = await chain.getAgent({ name: 'testing1', address: '...' })
  assert.ok(agent instanceof Agent,    'an Agent was returned')
  assert.ok(agent.address,             'agent has address')
  assert.equal(agent.name, 'testing1', 'agent.name assigned')
  assert.equal(agent.chain, chain,     'agent.chain assigned')
}

export async function testAgentMeta () {
  //client.address = 'someaddress' // FIXME
  //assert.ok(client.codeHash = await fetchCodeHash(client, agent))
  ////assert.ok(client.codeId   = await fetchCodeId(client, agent))
  //assert.ok(client.label    = await fetchLabel(client, agent))

  //assert.equal(client.codeHash, await fetchCodeHash(client, agent, client.codeHash))
  ////assert.equal(client.codeId,   await fetchCodeId(client, agent, client.codeId))
  //assert.equal(client.label,    await fetchLabel(client, agent, client.label))

  //assert.rejects(fetchCodeHash(client, agent, 'unexpected'))
  //assert.rejects(fetchCodeId(client, agent, 'unexpected'))
  //assert.rejects(fetchLabel(client, agent, 'unexpected'))

  //import { assertCodeHash, codeHashOf } from '@fadroma/agent'

  //assert.ok(assertCodeHash({ codeHash: 'code-hash-stub' }))
  //assert.throws(()=>assertCodeHash({}))

  //assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
  //assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
  //assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
}

export async function testAgentBatch () {
  //import { Chain, Agent, Batch } from '@fadroma/agent'
  //chain = new Chain({ id: 'id', url: 'example.com', mode: 'mainnet' })
  //agent = await chain.getAgent()
  //let batch: Batch
  //import { Client } from '@fadroma/agent'
  //batch = new Batch(agent)

  //assert(batch.getClient(Client, '') instanceof Client, 'Batch#getClient')
  //assert.equal(await batch.execute({}), batch)
  //assert.equal(batch.id, 1)
  ////assert(await batch.instantiateMany({}, []))
  ////assert(await batch.instantiateMany({}, [['label', 'init']]))
  ////assert(await batch.instantiate({}, 'label', 'init'))
  //assert.equal(await batch.checkHash(), 'code-hash-stub')

  //assert.rejects(()=>batch.query())
  //assert.rejects(()=>batch.upload())
  //assert.rejects(()=>batch.uploadMany())
  //assert.rejects(()=>batch.sendMany())
  //assert.rejects(()=>batch.send())
  //assert.rejects(()=>batch.getBalance())
  //assert.throws(()=>batch.height)
  //assert.throws(()=>batch.nextBlock)
  //assert.throws(()=>batch.balance)

  let chain: Chain = new Chain({ id: 'stub' })
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
  const log = new Console('(test message)')
  for (const key of Object.keys(log)) {
    const method = log[key as keyof typeof log] as any
    if (typeof method==='function') try { method.bind(log)() } catch (e) { console.warn(e) }
  }
}


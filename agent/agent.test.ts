import {
  StubChain as Chain, StubAgent as Agent, Batch, Client, Error, Console,
  assertChain, assertAgent
} from './agent'
import assert from 'node:assert'

import { TestSuite } from '@hackbg/ensuite'
export default new TestSuite(import.meta.url, [
  ['chain',   testChain],
  ['devnet',  testChainDevnet],
  ['agent',   testAgent],
  ['batch',   testBatch],
  ['errors',  testAgentErrors],
  ['console', testAgentConsole],
])

export async function testChain () {
  let chain = new Chain()
  assert.throws(()=>chain.id)
  assert.throws(()=>chain.id='foo')
  assert.throws(()=>chain.mode)
  assert.equal(chain.chain, chain)
  assert.equal(assertChain({ chain }), chain)
  chain = new Chain({ id: 'foo' })
  await chain.height
  await chain.getBalance('','')
  await chain.query(new Client(), {})
  await chain.getCodeId('')
  await chain.getHash('')
  await chain.getHash(0)
  await chain.getLabel('')

  assert.ok(Chain.mainnet().isMainnet)
  assert.ok(!(new Chain({ mode: Chain.Mode.Mainnet }).devMode))

  assert.ok(Chain.testnet().isTestnet)
  assert.ok(!(new Chain({ mode: Chain.Mode.Testnet }).devMode))

  assert.ok(Chain.devnet().isDevnet)
  assert.ok(Chain.devnet().devMode)

  assert.ok(new Chain({ mode: Chain.Mode.Mocknet }).isMocknet)
  assert.ok(new Chain({ mode: Chain.Mode.Mocknet }).devMode)
}

export async function testChainDevnet () {
  const devnet = {
    accounts: [],
    chainId: 'foo',
    platform: 'bar',
    running: false,
    stateDir: '/tmp/foo',
    url: new URL('http://example.com'),
    async start () { return this },
    async getAccount () { return {} },
    async assertPresence () {}
  }
  const chain = new Chain({ devnet, id: 'bar', url: 'http://asdf.com', mode: Chain.Mode.Mainnet })
  assert.equal(chain.id, 'foo')
  assert.equal(chain.url, 'http://example.com/')
  assert.equal(chain.mode, Chain.Mode.Devnet)
  assert.equal(chain.devnet, devnet)
  assert.equal(chain.stopped, true)
  devnet.running = true
  assert.equal(chain.stopped, false)
  assert.throws(()=>chain.id='asdf')
  assert.throws(()=>chain.url='asdf')
  assert.throws(()=>{
    //@ts-ignore
    chain.mode='asdf'
  })
  assert.throws(()=>chain.devnet=devnet)
  assert.throws(()=>chain.stopped=true)
  assert.equal(chain.log.label, 'foo @ http://example.com/')
}

export async function testAgent () {
  const chain = new Chain({ id: 'stub' })
  let agent: Agent = await chain.getAgent({ name: 'testing1', address: '...' })
  assert.ok(agent instanceof Agent,    'an Agent was returned')
  assert.ok(agent.address,             'agent has address')
  assert.equal(agent.name, 'testing1', 'agent.name assigned')
  assert.equal(agent.chain, chain,     'agent.chain assigned')

  await agent.ready
  agent.defaultDenom
  agent.balance
  agent.height
  //agent.nextBlock
  await agent.getBalance('a','b')
  await agent.query(new Client(), {})
  await agent.getCodeId('')
  await agent.getHash('')
  await agent.getHash(0)
  await agent.getLabel('')
  await agent.send('', [], {})
  await agent.sendMany([], {})
  await agent.upload(new Uint8Array(), {})
  await agent.instantiate({} as any)
  await agent.execute({}, {}, {})
  assert.equal(assertAgent({agent}), agent)
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

export async function testBatch () {
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
  assert.rejects(()=>batch.query({} as any, {}))
  assert.rejects(()=>batch.upload({} as any))
  assert.rejects(()=>batch.uploadMany())
  assert.rejects(()=>batch.sendMany([]))
  assert.rejects(()=>batch.send('', []))
  assert.rejects(()=>batch.getBalance(''))
  assert.throws(()=>batch.height)
  assert.throws(()=>batch.nextBlock)
  assert.throws(()=>batch.balance)

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


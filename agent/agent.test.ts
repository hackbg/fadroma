import {
  StubChain as Chain, StubAgent as Agent, Batch, Client, Error, Console,
  DeployStore, Deployment, Template, Contract,
  assertChain, assertAgent, linkStruct,
  fetchLabel, parseLabel, writeLabel,
  toBuildReceipt, toUploadReceipt, toInstanceReceipt,
  Builder, Uploader,
  Token, TokenFungible, TokenNonFungible, Swap
} from './agent'
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'

import { TestSuite } from '@hackbg/ensuite'
export default new TestSuite(import.meta.url, [
  ['errors',     testAgentErrors],
  ['console',    testAgentConsole],
  ['chain',      testChain],
  ['devnet',     testChainDevnet],
  ['agent',      testAgent],
  ['batch',      testBatch],
  ['client',     testClient],
  ['labels',     testLabels],
  ['deployment', testDeployment],
  ['receipts',   testReceipts],
  ['services',   testServices],
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
  assert.ok(!(Chain.mainnet().devMode))

  assert.ok(Chain.testnet().isTestnet)
  assert.ok(!(Chain.testnet().devMode))

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

export async function testLabels () {
  assert.equal(writeLabel({ prefix: 'foo', name: 'bar', suffix: 'baz' }), 'foo/bar+baz')
  assert.deepEqual(parseLabel('foo/bar+baz'), {
    label: 'foo/bar+baz', prefix: 'foo', name: 'bar', suffix: 'baz'
  })

  await fetchLabel(
    { address: 'foo' },
    new Chain({ id: 'foo', mode: Chain.Mode.Testnet }).getAgent(),
    'contract-label-stub'
  )
}

export async function testClient () {
  const chain = new Chain({ id: 'foo', mode: Chain.Mode.Testnet })
  const agent = new Agent({ chain })
  const client = new Client({ agent, address: 'addr', codeHash: 'code-hash-stub', codeId: '100' })
  assert.equal(client.chain, chain)
  assert.deepEqual(client.asContractLink, { address: 'addr', code_hash: 'code-hash-stub' })
  assert.deepEqual(client.asContractLink, linkStruct(client as any))
  //assert.deepEqual(client.asContractCode, { code_id: 100, code_hash: 'hash' })
  assert.deepEqual(await client.fetchCodeHash(), client)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})
  assert.deepEqual(client.withFee({ amount: [], gas: '123' }), client)
  assert.deepEqual(client.withFees({}), client)
  assert.deepEqual(client.withAgent(), client)
}

export async function testDeployment () {
  class TestDeployStore extends DeployStore {
    list () { return [] }
    load () { return { foo: {} } }
    save () {}
    async create () { return {} }
    async select () { return {} }
    get activeName () { return null }
  }
  const store = new TestDeployStore()
  const deployment = store.getDeployment()
  assert.ok(deployment instanceof Deployment)
  assert.equal(await deployment.save(), deployment)
  assert.equal(deployment.size, 0)
  assert.equal(new Deployment({ chain: Chain.mainnet() }).isMainnet, true)
  assert.equal(new Deployment({ chain: Chain.testnet() }).isTestnet, true)
  assert.equal(new Deployment({ chain: Chain.devnet() }).isDevnet, true)
  assert.equal(new Deployment({ chain: Chain.devnet() }).devMode, true)
  assert.deepEqual(new Deployment().snapshot, {contracts:{}})
  new Deployment().showStatus()
  assert.ok(new Deployment().template() instanceof Template)
  assert.ok(new Deployment().contract() instanceof Contract)
  await new Deployment().deploy()
  assert.equal(new Deployment().hasContract('foo'), false)
  new Deployment().getContract('foo')
  new Deployment().findContract()
  new Deployment().findContracts()
  new Deployment({ builder: { build () {}, buildMany () {} } }).buildContracts([])
  new Deployment({
    builder: { build () {}, buildMany () {} },
    uploader: { upload () {}, uploadMany () {}, agent: Chain.testnet().getAgent() },
  }).uploadContracts([])
  new Deployment().template().asContractCode
  new Deployment().template().description
  new Deployment().template().withAgent()
  new Deployment().template().instance()
  new Deployment().template().instances([])
  await (new Deployment({ builder: { build () {} } })
    .template({ crate: 'foo' })
    .built)
  await (new Deployment({
    builder: { build () {} },
    uploader: { upload () {}, agent: Chain.testnet().getAgent() },
  })
    .template({ crate: 'foo' })
    .uploaded)

  const d = new Deployment({
    builder: { build () {}, buildMany () {} },
    uploader: { upload () {}, uploadMany () {}, agent: Chain.testnet().getAgent() },
  })
  //d.contract({
    //name: 'foo', agent: Chain.testnet({ id: 'foo' }).getAgent(), initMsg: {}, crate: 'foo', codeId: '123'
  //})
  d.snapshot
  await d.deploy()
}

export async function testReceipts () {
  toBuildReceipt({})
  toUploadReceipt({})
  toInstanceReceipt({
    crate: 'asdf',
    artifact: 'asdf',
    chainId: 'asdf',
    codeId: 'asdf',
    codeHash: 'asdf',
    initMsg: {},
    address: 'asdf',
    label: 'asdf'
  })
}

export async function testServices () {
  class TestBuilder extends Builder {
    async build (...args: any[]) {
      return { artifact: 'asdf' }
    }
    async buildMany (...args: any[]) {
      return [{ artifact: 'asdf' }]
    }
    id = 'test-builder'
  }

  new TestBuilder()

  const agent = Chain.testnet({id:'foo'}).getAgent()

  await new Uploader({ agent }).upload({
    artifact: fixture('null.wasm'),
    codeHash: 'stub-code-hash'
  })

  //await new Uploader({ agent }).uploadMany([])
  //await new Uploader({ agent }).uploadMany([{ artifact: 'asdf' }])
}

export async function testToken () {

  new (class extends Token {
    get id () { return 'token' }
    isFungible () { return true }
  })()

  new (class extends TokenFungible {
    get id () { return 'token' }
    isNative () { return true }
    isCustom () { return false }
  })()

  new (class extends TokenNonFungible {
    get id () { return 'token' }
    isNative () { return true }
    isCustom () { return false }
  })()

}

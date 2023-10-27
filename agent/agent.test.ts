import {
  Error, Console,
  Chain, StubChain,
  Agent, StubAgent,
  Batch,
  ContractClient,
  DeployStore, Deployment, ContractTemplate, ContractInstance, DeploymentContractLabel,
  assertChain,
  Builder, StubBuilder,
  Token, TokenFungible, TokenNonFungible, Swap,
  addZeros, Coin, Fee
} from './agent'
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['errors',       testAgentErrors],
  ['console',      testAgentConsole],
  ['chain',        testChain],
  ['devnet',       testChainDevnet],
  ['agent',        testAgent],
  ['batch',        testBatch],
  ['client',       testClient],
  ['labels',       testLabels],
  ['deployment',   testDeployment],
  ['deploy-store', testDeployStore],
  ['services',     testServices],
  ['decimals',     testDecimals],
  ['token',        testToken],
])

export async function testChain () {
  let chain = new StubChain()
  assert.throws(()=>chain.id)
  assert.throws(()=>chain.id='foo')
  assert.throws(()=>chain.mode)

  assert.throws(()=>new StubChain({
    mode: StubChain.Mode.Devnet,
    id:   'stub',
    url:  'stub'
  }).ready)

  assert.equal(chain.chain, chain)
  assert.equal(assertChain({ chain }), chain)

  chain = new StubChain({
    mode: StubChain.Mode.Testnet,
    id:   'stub',
    url:  'stub'
  })
  assert.ok((await chain.ready).api)
  await chain.height
  await chain.nextBlock
  await chain.getBalance('','')
  await chain.query('', {})
  await chain.getCodeId('')
  await chain.getHash('')
  await chain.getHash(0)
  await chain.getLabel('')

  Object.defineProperty(chain, 'height', {
    get () { return Promise.resolve('NaN') }
  })
  assert.equal(await chain.nextBlock, NaN)

  assert.ok(StubChain.mainnet().isMainnet)
  assert.ok(!(StubChain.mainnet().devMode))

  assert.ok(StubChain.testnet().isTestnet)
  assert.ok(!(StubChain.testnet().devMode))

  assert.ok(StubChain.devnet().isDevnet)
  assert.ok(StubChain.devnet().devMode)

  assert.ok(new StubChain({ mode: Chain.Mode.Mocknet }).isMocknet)
  assert.ok(new StubChain({ mode: Chain.Mode.Mocknet }).devMode)

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

  const chain = new StubChain({
    mode: Chain.Mode.Mainnet,
    devnet,
    id: 'bar',
    url: 'http://asdf.com',
  })

  const ready = chain.ready
  assert.ok(await ready)
  assert.ok(chain.ready === ready)

  // Properties from Devnet are passed onto Chain
  assert.equal(chain.devnet, devnet)
  assert.equal(chain.id, 'foo')
  assert.equal(chain.url, 'http://example.com/')
  assert.equal(chain.mode, StubChain.Mode.Devnet)
  assert.equal(chain.log.label, 'foo @ http://example.com/')

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
}

export async function testAgent () {
  const chain = new StubChain({ id: 'stub' })
  let agent: Agent = await chain.getAgent({ name: 'testing1', address: '...' })
  assert.ok(agent instanceof StubAgent,    'an Agent was returned')
  assert.ok(agent.address,             'agent has address')
  assert.equal(agent.name, 'testing1', 'agent.name assigned')
  assert.equal(agent.chain, chain,     'agent.chain assigned')

  const ready = agent.ready
  assert.ok(await ready)
  assert.ok(agent.ready === ready)

  agent.defaultDenom
  agent.balance
  agent.height
  agent.nextBlock

  await agent.getBalance('a','b')

  await agent.query('', {})

  await agent.getCodeId('')

  await agent.getHash('')
  await agent.getHash(0)

  await agent.getLabel('')

  await agent.send('', [], {})
  await agent.sendMany([], {})

  await agent.upload(fixture('null.wasm'), {})
  await agent.upload(new Uint8Array(), {})
  await agent.uploadMany([], {})
  await agent.uploadMany({}, {})

  await agent.instantiate('1', {
    label: 'foo',
    initMsg: 'bar'
  })

  await agent.instantiate({
    codeId: '1'
  }, {
    label: 'foo',
    initMsg: 'bar'
  })

  await agent.instantiateMany([])

  await agent.instantiateMany({})

  await agent.execute('stub', {}, {})
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
  //chain = new StubChain({ id: 'id', url: 'example.com', mode: 'mainnet' })
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

  let chain: Chain = new StubChain({ id: 'stub' })
  let agent: Agent = await chain.getAgent({ name: 'job', address: 'testing1agent0' })
  let batch: Batch

  assert(agent.batch() instanceof Batch)

  const batchedOperations = async (batch: Batch) => {
    assert(batch instanceof Batch)
    assert.rejects(()=>batch.query({} as any, {}))
    assert.rejects(()=>batch.upload({}))
    assert.rejects(()=>batch.uploadMany())
    assert.rejects(()=>batch.sendMany([]))
    assert.rejects(()=>batch.send('', []))
    assert.rejects(()=>batch.getBalance(''))
    assert.throws(()=>batch.height)
    assert.throws(()=>batch.nextBlock)
    assert.throws(()=>batch.balance)
    assert.rejects(()=>batch.doUpload(undefined as any))
    await batch.instantiate({} as any, {} as any)
    assert.rejects(()=>batch.instantiateMany(undefined as any))
    assert.deepEqual(await batch.instantiateMany({}), {})
    assert.deepEqual(await batch.instantiateMany([]), [])
    await batch.execute('addr', {}, {})
    assert.ok(await batch.getCodeId('addr'))
    assert.ok(await batch.getLabel('addr'))
    assert.ok(await batch.getHash('addr'))
    assert.ok(await batch.checkHash('addr'))
  }

  class TestBatch extends Batch {}

  const batch1 = new TestBatch(agent, batchedOperations)
  assert.equal(await batch1.ready, batch1)
  assert.equal(batch1.name, `job (batched)`)
  assert.equal(batch1.fees, agent.fees)
  assert.equal(batch1.defaultDenom, agent.defaultDenom)

  const batch2 = new TestBatch(agent)
  assert.deepEqual(batch2.msgs, [])
  assert.equal(batch2.id, 0)
  assert.throws(()=>batch2.assertMessages())
  assert.equal(batch2.add({}), 0)
  assert.deepEqual(batch2.msgs, [{}])
  assert.equal(batch2.id, 1)
  assert.ok(batch2.assertMessages())

  const batch3 = new TestBatch(agent, batchedOperations)
  assert.ok(await batch3.run(""))
  assert.ok(await batch3.run("", true))
  assert.equal(batch3.depth, 0)
  const batch3a = batch3.batch()
  assert.equal(batch3a.depth, 1)
  assert.equal(await batch3a.run(), null)

  agent = new class TestAgent extends StubAgent { Batch = class TestBatch extends Batch {} }

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
    const contract = new ContractClient({ agent, address: "secret1..." })
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
  assert.equal(
    new DeploymentContractLabel('foo', 'bar', 'baz').toString(), 'foo/bar+baz'
  )
  assert.deepEqual(DeploymentContractLabel.parse('foo/bar+baz'), {
    prefix: 'foo', name: 'bar', suffix: 'baz'
  })
  assert.deepEqual(DeploymentContractLabel.parse('foo/bar+baz').toString(), 'foo/bar+baz')
}

export async function testClient () {
  const chain = new StubChain({ id: 'foo', mode: Chain.Mode.Testnet })
  const agent = new StubAgent({ chain })
  const client = new ContractClient({
    address: 'addr', codeHash: 'code-hash-stub', codeId: '100'
  }, agent)
  assert.equal(client.agent, agent)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})
}

export async function testDeployStore () {
  class TestDeployStore extends DeployStore {
    list () { return [] }
    load () { return { foo: {} } as any }
    save () {}
    async create () { return {} }
    async select () { return {} }
    get activeName () { return null }
  }
  const store = new TestDeployStore()
  const deployment = store.getDeployment()
  assert.ok(deployment instanceof Deployment)
}

export async function testDeployment () {
  //assert.equal(await deployment.save(), deployment)
  //assert.equal(deployment.size, 0)

  for (const mode of [Chain.Mode.Mainnet, Chain.Mode.Testnet]) {

    const deployment = new Deployment({
      name: 'foo',
      mode
    })

    assert.deepEqual(deployment.toReceipt(), {
      contracts: {},
      templates: {},
      name: 'foo',
      mode,
    })

    let foo
    assert.ok(
      (foo = deployment.template({ codeData: new Uint8Array() })) instanceof ContractTemplate
    )

    assert.ok(
      deployment.contract('bar', {}) instanceof ContractInstance
    )

    assert.ok(
      foo.instance('baz') instanceof ContractInstance
    )

    await deployment.build({
      builder: new StubBuilder()
    })

    await deployment.upload({
      agent: new StubAgent()
    })

    await deployment.deploy({
      agent: new StubAgent()
    })

    new Console().deployment(deployment)

  }

  //new Deployment().showStatus()

  //assert.equal(new Deployment().hasContract('foo'), false)
  //new Deployment().getContract('foo')
  //new Deployment().findContract()
  //new Deployment().findContracts()
  //new Deployment({ builder: { build () {}, buildMany () {} } }).buildContracts([])
  //new Deployment({
    //builder: { build () {}, buildMany () {} },
    //uploader: { upload () {}, uploadMany () {}, agent: Chain.testnet().getAgent() },
  //}).uploadContracts([])
  //new Deployment().template().asContractCode
  //new Deployment().template().description
  //new Deployment().template().withAgent()
  //new Deployment().template().instance()
  //new Deployment().template().instances([])
  //await (new Deployment({ builder: { build () {} } })
    //.template({ crate: 'foo' })
    //.built)
  //await (new Deployment({
    //builder: { build () {} },
    //uploader: { upload () {}, agent: Chain.testnet().getAgent() },
  //})
    //.template({ crate: 'foo' })
    //.uploaded)

  //const d = new Deployment({
    //builder: { build () {}, buildMany () {} },
    //uploader: { upload () {}, uploadMany () {}, agent: Chain.testnet().getAgent() },
  //})
  ////d.contract({
    ////name: 'foo', agent: Chain.testnet({ id: 'foo' }).getAgent(), initMsg: {}, crate: 'foo', codeId: '123'
  ////})
  //d.snapshot
  //await d.deploy()
}

export async function testServices () {

  new StubBuilder()

  const agent = StubChain.testnet({id:'foo'}).getAgent()

  //await new Uploader({ agent }).upload({
    //artifact: fixture('null.wasm'),
    //codeHash: 'stub-code-hash'
  //})

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

  new Coin(1000, 'utest')
  new Coin('1000', 'utest')

  // FIXME: new Fee(gas, amounts[])
  new Fee(1000, 'utest', '100000')

}

export async function testDecimals () {
  assert.equal(addZeros('1', 18), '1000000000000000000')
}

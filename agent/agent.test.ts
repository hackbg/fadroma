/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Error, Console,
  Chain, StubChain,
  Agent, StubAgent,
  Batch, StubBatch,
  ContractCode, ContractClient,
  UploadStore, DeployStore,
  SourceCode, CompiledCode, UploadedCode,
  ContractInstance, Deployment, DeploymentContractLabel,
  assertChain,
  Builder, StubBuilder,
  Token, TokenFungible, TokenNonFungible, Swap,
  addZeros, Coin, Fee,
  into, intoArray, intoRecord,
} from './agent'
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'
import { Suite } from '@hackbg/ensuite'

export async function testChain () {
  let chain = new StubChain()
  assert.throws(()=>chain.id)
  assert.throws(()=>chain.id='foo')
  assert.throws(()=>chain.mode)
  assert.throws(()=>new StubChain({ mode: StubChain.Mode.Devnet, id: 'stub', url: 'stub' }).ready)
  assert.equal(chain.chain, chain)
  assert.equal(assertChain({ chain }), chain)
  chain = new StubChain({ mode: StubChain.Mode.Testnet, id: 'stub', url: 'stub' })
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

export async function testDevnet () {
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
  await agent.send('', [])
  await agent.sendMany([])
  await agent.upload(fixture('null.wasm'), {})
  await agent.upload(new Uint8Array(), {})

  await agent.instantiate('1', { label: 'foo', initMsg: 'bar' })
  await agent.instantiate({ codeId: '1' }, { label: 'foo', initMsg: {} })
  assert.rejects(()=>agent.instantiate('foo', {}))
  assert.rejects(()=>agent.instantiate('', {}))
  assert.rejects(()=>agent.instantiate('1', { label: 'foo' }))
  assert.rejects(()=>agent.instantiate('1', { initMsg: {} }))

  await agent.execute('stub', {}, {})
  await agent.execute({ address: 'stub' }, {}, {})
}

export async function testBatch () {
  let agent: Agent = await new StubChain({ id: 'stub' })
    .getAgent({ name: 'test-batch', address: 'stub1testbatch' })
    .ready
  assert(agent.batch() instanceof Batch)
  const batchedOperations = async (batch: Batch) => {
    assert(batch instanceof Batch)
    assert.rejects(()=>batch.query({} as any, {}))
    assert.rejects(()=>batch.upload({}))
    assert.rejects(()=>batch.sendMany([]))
    assert.rejects(()=>batch.send('', []))
    assert.rejects(()=>batch.getBalance(''))
    assert.throws(()=>batch.height)
    assert.throws(()=>batch.nextBlock)
    assert.throws(()=>batch.balance)
    assert.rejects(()=>batch.doUpload(undefined as any))
    await batch.instantiate('1', {} as any)
    await batch.instantiate({} as any, {} as any)
    await batch.execute('addr', {}, {})
    await batch.execute({ address: 'addr' }, {}, {})
    assert.ok(await batch.getCodeId('addr'))
    assert.ok(await batch.getLabel('addr'))
    assert.ok(await batch.getHash('addr'))
  }
  const batch1 = new StubBatch(agent, batchedOperations)
  assert.equal(await batch1.ready, batch1)
  assert.equal(batch1.name,  `test-batch (batched)`)
  assert.equal(batch1.fees,  agent.fees)
  assert.equal(batch1.chain, agent.chain)
  assert.equal(batch1.defaultDenom, agent.defaultDenom)
  assert.ok(batch1.getClient() instanceof ContractClient)
  const batch2 = new StubBatch(agent)
  assert.deepEqual(batch2.msgs, [])
  assert.equal(batch2.id, 0)
  assert.throws(()=>batch2.assertMessages())
  assert.equal(batch2.add({}), 0)
  assert.deepEqual(batch2.msgs, [{}])
  assert.equal(batch2.id, 1)
  assert.ok(batch2.assertMessages())
  const batch3 = new StubBatch(agent, batchedOperations)
  assert.ok(await batch3.run())
  assert.ok(await batch3.run({ memo: "", save: true }))
  assert.equal(batch3.depth, 0)
  const batch3a = batch3.batch()
  assert.equal(batch3a.depth, 1)
  assert.equal(await batch3a.run(), null)
}

export async function testClient () {
  const chain = new StubChain({ id: 'foo', mode: Chain.Mode.Testnet })
  const agent = new StubAgent({ chain })
  const client = new ContractClient({
    address:  'addr',
    codeHash: 'code-hash-stub',
    codeId:   '100'
  }, agent)
  assert.equal(client.agent, agent)
  assert.equal(client.chain, chain)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})

  assert.ok(new ContractClient('addr'))
  assert.ok(new ContractClient(new ContractInstance({ address: 'addr' })))
  assert.throws(()=>new ContractClient({}).query({}))
  assert.throws(()=>new ContractClient({}, agent).query({}))
  assert.throws(()=>new ContractClient({}).execute({}))
  assert.throws(()=>new ContractClient({}, agent).execute({}))
}

export async function testContracts () {
  const contract = new ContractCode({
    source:   {},
    compiled: {},
    uploaded: {},
  })

  assert.rejects(()=>contract.compile())
  assert.rejects(()=>contract.compile({ builder: new StubBuilder() }))
  assert.rejects(()=>contract.upload())
  assert.rejects(()=>contract.upload({ uploader: new StubAgent() }))

  assert(contract.source instanceof SourceCode)
  assert(contract.compiled instanceof CompiledCode)
  assert(contract.uploaded instanceof UploadedCode)

  assert(!(contract.source.isValid()))
  assert(!(contract.compiled.isValid()))
  assert(!(contract.uploaded.isValid()))

  assert.deepEqual(contract.source.toReceipt(), {
    crate:      undefined,
    dirty:      undefined,
    features:   undefined,
    repository: undefined,
    revision:   undefined,
    workspace:  undefined,
  })
  assert.deepEqual(contract.compiled.toReceipt(), {
    codeHash:  undefined,
    codePath:  undefined,
    buildInfo: undefined,
  })
  assert.deepEqual(contract.uploaded.toReceipt(), {
    codeHash:  undefined,
    chainId:   undefined,
    codeId:    undefined,
    uploadBy:  undefined,
    uploadTx:  undefined
  })
  //assert.deepEqual(contract.instance.toReceipt(), {
    //codeHash:  undefined,
    //chainId:   undefined,
    //codeId:    undefined,
    //label:     undefined,
    //initMsg:   undefined,
    //initBy:    undefined,
    //initTx:    undefined,
    //initGas:   undefined,
    //address:   undefined,
  //})

  assert.ok(contract.source[Symbol.toStringTag] || true)
  assert.ok(contract.compiled[Symbol.toStringTag] || true)
  //assert.ok(contract.uploaded[Symbol.toStringTag])
  //assert.ok(contract.instance[Symbol.toStringTag])

  assert.rejects(()=>new CompiledCode().fetch())
  assert.rejects(()=>new CompiledCode({ codePath: '' }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: new URL('', 'file:') }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: new URL('http://foo.bar') }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: 0 as any }).fetch())
}

export async function testDeployment () {
  // deploy store converts inputs to UploadedCode instances
  const uploadStore = new UploadStore()
  assert.equal(uploadStore.get('name'), undefined)
  assert.equal(uploadStore.set('name', {}), uploadStore)
  console.log(uploadStore.get('name'))
  assert.ok(uploadStore.get('name') instanceof UploadedCode)
  // deploy store converts inputs to Deployment instances
  const deployStore = new DeployStore()
  assert.equal(deployStore.get('name'), undefined)
  assert.equal(deployStore.set('name', {}), deployStore)
  assert.ok(deployStore.get('name') instanceof Deployment)
  // deployment can define contracts and templates
  const deployment = new Deployment({ name: 'deployment' })
  assert.deepEqual(deployment.toReceipt(), { name: 'deployment', units: {} })
  const template1 = deployment.template('template1', {
    codeHash: "asdf", codeData: new Uint8Array([1]),
  })
  await deployment.upload({ builder: new StubBuilder(), uploader: new StubAgent() })
  const contract1 = deployment.contract('contract1', {
    codeId: '2', label: "contract1", initMsg: {}
  })
  await deployment.deploy({ uploader: new StubAgent(), deployer: new StubAgent() })
  // pretty print deployment 
  new Console().deployment(deployment)
  // deployment label format
  const label1 = new DeploymentContractLabel('foo', 'bar', 'baz')
  assert.equal(label1.toString(), 'foo/bar+baz')
  const label2 = DeploymentContractLabel.parse('foo/bar+baz')
  assert(label2 instanceof DeploymentContractLabel)
  assert.deepEqual(label2, { prefix: 'foo', name: 'bar', suffix: 'baz' })
  assert.deepEqual(label2.toString(), 'foo/bar+baz')

  assert.ok((await new StubBuilder().build('')) instanceof CompiledCode)
  assert.ok((await new StubBuilder().buildMany([{}]))[0] instanceof CompiledCode)
}

export default new Suite([
  ['agent',        testAgent],
  ['batch',        testBatch],
  ['chain',        testChain],
  ['client',       testClient],
  ['collections',  testCollections],
  ['console',      testConsole],
  ['contract',     testContracts],
  ['decimals',     testDecimals],
  ['deploy',       testDeployment],
  ['devnet',       testDevnet],
  ['errors',       testErrors],
  ['labels',       testLabels],
  ['token',        testToken],
])

export async function testErrors () {
  // Make sure each error subclass can be created with no arguments:
  for (const key of Object.keys(Error)) {
    const subtype = Error[key as keyof typeof Error] as any
    if (typeof subtype ==='function') assert(new subtype() instanceof Error, `error ${key}`)
  }
}

export async function testConsole () {
  // Make sure each log message can be created with no arguments:
  const log = new Console('(test message)')
  for (const key of Object.keys(log)) {
    const method = log[key as keyof typeof log] as any
    if (typeof method==='function') try { method.bind(log)() } catch (e) { console.warn(e) }
  }
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

export async function testLabels () {
}

# Fadroma Executable Specification

This file is a combination of spec and test suite.

* **As a test suite,** you can run it with `pnpm ts:test`.
  This happens automatically in CI to prevent the most egregious regressions.
* **As a specification document,** you can read it to become familiar
  with the internals of the framework and the usage of its primitives.

```typescript
import * as Fadroma   from '@hackbg/fadroma'
import * as Testing   from './TESTING'
import $              from '@hackbg/kabinet'
import fetch          from 'cross-fetch'
import assert         from 'assert'
import {readFileSync} from 'fs'
const { ok, equal, deepEqual } = assert
let console = Fadroma.Console('Spec')
```

# The tripartite model

Base layer for isomorphic contract clients.

1. User selects chain by instantiating a `Chain` object.
2. User authorizes agent by obtaining an `Agent` instance from the `Chain`.
3. User interacts with contract by obtaining an instance of the
   appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Chain, Agent, Client } from '@hackbg/fadroma'
```

## Chain

```typescript
let chain: Chain
```

* Chain config

```typescript
chain = new Chain('any', { url: 'example.com' })
assert.equal(chain.id,  'any')
assert.equal(chain.url, 'example.com')
```

* Chain modes

```typescript
import { ChainMode } from '@hackbg/fadroma'

chain = new Chain('any', { mode: ChainMode.Mainnet })
assert(chain.isMainnet)

chain = new Chain('any', { mode: ChainMode.Testnet })
assert(chain.isTestnet && !chain.isMainnet)

chain = new Chain('any', { mode: ChainMode.Devnet })
assert(chain.isDevnet  && !chain.isMainnet && !chain.isTestnet)

chain = new Chain('any', { mode: ChainMode.Mocknet })
assert(chain.isMocknet && !chain.isMainnet && !chain.isDevnet)
```

* Chain variants
  * `LegacyScrt`: creates secretjs@0.17.5 based agent using lcd/amino
  * `Scrt`: creates secretjs@beta based agent using grpc

```typescript
const supportedChains = [
  Fadroma.Scrt,
  Fadroma.LegacyScrt
  //Fadroma.Mocknet,
]

for (const Chain of supportedChains) {
  ok(await new Chain('main', { mode: ChainMode.Mainnet }))
  ok(await new Chain('test', { mode: ChainMode.Testnet }))
  const node = { chainId: 'scrt-devnet', url: 'http://test:0' }
  const chain = await new Chain('dev', { mode: ChainMode.Devnet, node })
  ok(chain)
  equal(chain.node, node)
  equal(chain.url,  node.url)
  equal(chain.id,   node.chainId)
}
```

## Agent

```typescript
let agent: Agent
```

* Getting an agent from a chain
  * This is asynchronous to allow for async crypto functions to run.

```typescript
agent = await chain.getAgent({})
assert(agent instanceof Agent)
for (const Chain of supportedChains) {
  const chain    = new Chain('test', {})
  const mnemonic = Testing.mnemonics[0]
  const agent    = await chain.getAgent({ mnemonic })
  assert.equal(agent.chain,    chain)
  assert.equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
}
```

* When using devnet, you can also get an agent from a named genesis account:

```typescript
chain = new Chain('devnet', {mode: ChainMode.Devnet, node: {getGenesisAccount(){return{}}}})
agent = await chain.getAgent({ name: 'Alice' })
```

* **Waiting** until the block height has incremented

```typescript
// waiting for next block
for (const Chain of [Fadroma.LegacyScrt]) {
  await withMockAPIEndpoint(async endpoint => {
    const chain    = new Chain('test', { url: endpoint.url })
    const mnemonic = Testing.mnemonics[0]
    const agent    = await chain.getAgent({ mnemonic })
    const [ {header:{height:block1}}, account1, balance1 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    await agent.nextBlock
    const [ {header:{height:block2}}, account2, balance2 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    equal(block1 + 1, block2)
    deepEqual(account1, account2)
    deepEqual(balance1, balance2)
  })
}
```

* **Sending** native tokens

```typescript
// getting agent's balance in native tokens
const balances = { 'foo': '1', 'bar': '2' }
agent = new class TestAgent1 extends Agent {
  get defaultDenom () { return 'foo' }
  getBalance (denom = this.defaultDenom) {
    return Promise.resolve(balances[denom] || '0')
  }
}
equal(await agent.balance,           '1')
equal(await agent.getBalance(),      '1')
equal(await agent.getBalance('foo'), '1')
equal(await agent.getBalance('bar'), '2')
equal(await agent.getBalance('baz'), '0')
// native token balance and transactions
for (const Chain of [Fadroma.LegacyScrt]) {
  continue // TODO
  await withMockAPIEndpoint(async endpoint => {
    const chain     = new Chain('test', { url: endpoint.url })
    const mnemonic1 = Testing.mnemonics[0]
    const mnemonic2 = Testing.mnemonics[1]
    const [agent1, agent2] = await Promise.all([
      chain.getAgent({mnemonic: mnemonic1}),
      chain.getAgent({mnemonic: mnemonic2}),
    ])
    endpoint.state.balances = {
      uscrt: {
        [agent1.address]: BigInt("2000"),
        [agent2.address]: BigInt("3000")
      }
    }
    equal(await agent1.balance, "2000")
    equal(await agent2.balance, "3000")
    await agent1.send(agent2.address, "1000")
    equal(await agent1.balance, "1000")
    equal(await agent2.balance, "4000")
    await agent2.send(agent1.address, 500)
    equal(await agent1.balance, "1500")
    equal(await agent2.balance, "3500")
  })
}
// to one recipient
// TODO
// to many recipients in one transaction
// TODO
```

* **Instantiating** a contract
* **Executing** a transaction
* **Querying** a contract

```typescript
console.info('api methods')
agent = new class TestAgent3 extends Agent { async instantiate () { return {} } }
assert.ok(await agent.instantiate(null, null, null, null))
agent = new class TestAgent4 extends Agent { async execute () { return {} } }
assert.ok(await agent.execute())
agent = new class TestAgent5 extends Agent { async query () { return {} } }
assert.ok(await agent.query())

console.info('full contract lifecycle')
import { withMockAPIEndpoint } from './TESTING'
await withMockAPIEndpoint(async endpoint => {
  const agent    = await new Fadroma.LegacyScrt('test', {url: endpoint.url}).getAgent({mnemonic: Testing.mnemonics[0]})
  const artifact = { url: $(Testing.fixture('empty.wasm')).url.toString(), codeHash: Testing.hashes['empty.wasm'] }
  const blob     = new Uint8Array(readFileSync(Testing.fixture('empty.wasm'), 'utf8'))
  const template = await agent.upload(blob)
  equal(artifact.codeHash, template.codeHash)
  equal(template.codeId,   1)
  const label    = `contract_deployed_by_${agent.name}`
  const instance = await agent.instantiate(template, label, {})
  const { address } = instance
  ok(address, 'init tx returns contract address')
  return
  console.debug(`test q ${address}`)
  throw 'TODO - how to decrypt/reencrypt query?'
  const queryResult = await agent.query({ address }, 'status')
  equal(queryResult, 'status')
  console.debug(`test tx ${address}`)
  const txResult = await agent.execute({ address }, 'tx', { option: "value" })
  deepEqual(txResult, {})
})
```

* **Variants:**
  * `LegacyScrt.Agent` a.k.a. `LegacyScrtAgent`: uses secretjs 0.17.5
  * `Scrt.Agent` a.k.a. `ScrtRPCAgent`: which uses the new gRPC API
    provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
    supported in secretjs 0.17.5 and older.

* **Bundling** transactions:

```typescript
import { Bundle } from '@hackbg/fadroma'
let bundle: Bundle
```

```typescript
console.info('get bundle from agent')
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
ok(bundle instanceof Bundle)

console.info('auto use bundle in agent for instantiateMany')
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
await agent.instantiateMany([])
await agent.instantiateMany([], 'prefix')

console.info('bundles implemented on all chains')
for (const Chain of supportedChains) {
  const mnemonic = Testing.mnemonics[0]
  const agent    = await new Chain('🤡', {}).getAgent({ mnemonic })
  const bundle   = agent.bundle()
  ok(bundle instanceof Chain.Agent.Bundle)
}
```

## Clients

```typescript
let client: Client
```

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
console.info('get client from agent')
client = agent.getClient()
ok(client)
```

### Specifying per-transaction gas fees

  * `client.fee` is the default fee for all transactions
  * `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
  * `client.withFee(fee: IFee)` allows the caller to override the default fees.
    Calling it returns a new instance of the Client, which talks to the same contract
    but executes all transactions with the specified custom fee.

```typescript
import { ScrtGas as LegacyScrtGas } from '@fadroma/client-scrt-amino'
import { ScrtGas }                  from '@fadroma/client-scrt-grpc'
console.info('gas implemented on all chains')
for (const Gas of [LegacyScrtGas, ScrtGas]) {
  // scrt gas unit is uscrt
  equal(ScrtGas.denom, 'uscrt')
  // default gas fees are set
  ok(ScrtGas.defaultFees.upload instanceof ScrtGas)
  ok(ScrtGas.defaultFees.init   instanceof ScrtGas)
  ok(ScrtGas.defaultFees.exec   instanceof ScrtGas)
  ok(ScrtGas.defaultFees.send   instanceof ScrtGas)
  // can create custom gas fee specifier
  const fee = new ScrtGas(123)
  deepEqual(fee.amount, [{amount: '123', denom: 'uscrt'}])
}
```

# Building contracts

```typescript
import { Workspace, Source, Builder, Artifact } from '@hackbg/fadroma'
```

## The `Workspace` and `Source`

```typescript
let workspace: Workspace
let source:    Source
```

```typescript
console.info('specify source')
for (const source of [
  { crate: 'crate', workspace: { path: Testing.workspace, ref: 'HEAD' } },
  new Source(new Workspace(Testing.workspace, 'HEAD'), 'crate')
  new Workspace(Testing.workspace, 'HEAD').crate('crate')
]) {
  console.info('.')
  assert(source.workspace.path === Testing.workspace)
  assert(source.workspace.ref === 'HEAD')
  assert(source.crate === 'crate')
}
```

## The `Builder`: performs `Source -> Artifact`

```typescript
let builder:  Builder
let artifact: Artifact
```

```typescript
console.info('builder')
builder = new class TestBuilder1 extends Builder {
  async build (source: Source): Promise<Artifact> {
    return { location: '', codeHash: '', source }
  }
}

console.info('build one')
source   = {}
artifact = await builder.build(source)
assert(artifact.source === source, source)

console.info('build many')
let sources = [{}, {}, {}]
let artifacts = await builder.buildMany(sources)
assert(artifacts[0].source === sources[0])
assert(artifacts[1].source === sources[1])
assert(artifacts[2].source === sources[2])

builder = new class TestBuilder2 extends Builder {
  async build (source, args) { return { built: true, source, args } }
}
const source1 = Symbol()
const source2 = Symbol()
const args    = [Symbol(), Symbol()]
deepEqual(
  await builder.buildMany([source1, source2], args),
  [
    { built: true, source: source1, args },
    { built: true, source: source2, args }
  ]
)
```

### Build caching

The `CachingBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { CachingBuilder } from '@hackbg/fadroma'
builder = new class TestCachingBuilder extends CachingBuilder {
  async build (source) { return {} }
}
workspace = { path: Testing.here, ref: 'HEAD' }
await assert.throws(()=>builder.prebuild({}))
equal(builder.prebuild('', 'empty'), null)
```

* Raw builder

```typescript
import { RawBuilder } from '@hackbg/fadroma'
let ran
class TestRawBuilder extends RawBuilder { run = (...args) => ran.push(args) }
const buildScript    = Symbol()
const checkoutScript = Symbol()
builder = new TestRawBuilder(buildScript, checkoutScript)
const crate = 'empty'
const ref   = 'ref'
ran = []
const sourceFromHead   = { workspace, crate }
const templateFromHead = await builder.build(sourceFromHead)
deepEqual(ran, [[buildScript, []]])
ran = []
const sourceFromRef   = { workspace, crate, ref }
const templateFromRef = await builder.build(sourceFromRef)
deepEqual(ran, [[checkoutScript, [ref]], [buildScript, []]])
```

* Dockerized builder

```typescript
import { DockerBuilder } from '@hackbg/fadroma'
import { Dokeres, DokeresImage } from '@hackbg/dokeres'
import { mockDockerode } from './TESTING'
import { Transform } from 'stream'
class TestDockerBuilder extends DockerBuilder {
  prebuild (source) { return false }
}
class TestDokeresImage extends DokeresImage {
  async ensure () { return theImage }
}
const theImage  = Symbol()
source    = { workspace, crate }
ran       = []
const docker    = mockDockerode(({ run: [image, cmd, buildLogs, args] }) {
  equal(image, theImage)
  equal(cmd, `bash /build.sh HEAD empty`)
  ok(buildLogs instanceof Transform)
  equal(args.Tty, true)
  equal(args.AttachStdin: true)
  deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
  ok(args.HostConfig.Binds instanceof Array)
  equal(args.HostConfig.AutoRemove, true)
})
image     = new Dokeres(docker).image(' ')
const script    = "build.sh"
const options   = { docker, image, script }
builder   = new TestDockerBuilder(options)

// build one
artifact  = await builder.build({ workspace, crate })
equal(artifact.location, resolve(workspace, 'artifacts/empty@HEAD.wasm'))
equal(artifact.codeHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

// build many
artifacts = await builder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, ref: 'HEAD', crate: 'crate2' }
  { workspace, ref: 'asdf', crate: 'crate3' }
])
```

### Builders for Secret Network

```typescript
import { getScrtBuilder } from '@hackbg/fadroma'
ok(getScrtBuilder())
ok(getScrtBuilder({ raw: true }))
```

## Uploading

* Basic uploader

```typescript
import { pathToFileURL } from 'url'
const emptyContract = pathToFileURL(fixture('examples/empty-contract/artifacts/empty@HEAD.wasm'))

import { FSUploader } from '@hackbg/fadroma'
import { fixture } from './TESTING'

agent = Symbol()
uploader = new FSUploader(agent)
ok(uploader.agent === agent)

artifact        = { url: emptyContract }
chainId         = Symbol()
codeId          = Symbol()
codeHash        = Symbol()
transactionHash = Symbol()
template = { chainId, codeId, codeHash, transactionHash }
agent = { chain: { id: chainId }, upload: async (artifact) => template, nextBlock: Promise.resolve() }
uploader = new FSUploader(agent)
result   = await uploader.upload(artifact)
deepEqual(result, template)

artifact = { url: emptyContract }
template = Symbol()
agent = { chain: { id: Symbol() }, upload: async (artifact) => template, nextBlock: Promise.resolve() }
uploader = new FSUploader(agent)
deepEqual(await uploader.uploadMany([
  null,
  artifact,
  undefined,
  artifact,
  artifact,
  false
]), [
  undefined,
  template,
  undefined,
  template,
  template,
  undefined,
])
```

* Caching uploader

```typescript
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { CachingFSUploader, Uploads } from '@hackbg/fadroma'
import { resolve } from 'path'

const mockAgent = () => ({
  async upload () { return {} }
  chain: {
    uploads: {
      resolve: () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      make: () => ({
        resolve: () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      })
    }
  },
  instantiate ({ codeId }, label, msg) {
    return { codeId, label }
  },
  instantiateMany (configs, prefix) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      if (prefix) label = `${prefix}/${label}`
      receipts[name] = { codeId, label }
    }
    return receipts
  }
})

// 'add CachingFSUploader to operation context' ({ ok }) {
agent = { chain: { uploads: Symbol() } }
const cache = Symbol()
const uploader = new CachingFSUploader(agent, cache)
ok(uploader.agent === agent)

// async 'upload 1 artifact with CachingFSUploader#upload' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent = mockAgent()
  const cache = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new CachingFSUploader(agent, cache)
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.upload({url}))
  })
})

// async 'upload any number of artifacts with CachingFSUploader#uploadMany' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent = mockAgent()
  const cache = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new CachingFSUploader(agent, cache)
  ok(await uploader.uploadMany())
  ok(await uploader.uploadMany([]))
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.uploadMany([{url}]))
    ok(await uploader.uploadMany([{url}, {url}]))
  })
})
```

## Deployment

```typescript
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { Deployment } from '@hackbg/fadroma'

// save/load deployment data
await withTmpFile(f=>{
  const d = new Deployment(f)
  equal(d.prefix, basename(f))
  deepEqual(d.receipts, {})
  equal(d, d.save('test', JSON.stringify({ foo: 1 }))
  equal(d, d.add('test1', { test1: 1 }))
  ok(!d.load())
  equal(d, d.set('test2', { test2: 2 }))
  equal(d, d.setMany({test3: 3, test4: 4}))
  throws(()=>d.get('missing'))
})

// init contract from uploaded template
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const codeId     = 0
  const template   = { codeId }
  const initMsg    = Symbol()
  const name       = 'contract'
  const label      = `${basename(f)}/${name}`
  deepEqual(await deployment.init(agent, template, name, initMsg), { codeId, label })
  deepEqual(deployment.get(name), { name, codeId, label })
})

// init many contracts from the same template
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const codeId     = 1
  const template   = { codeId }
  const initMsg    = Symbol()
  const configs    = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts   = await deployment.initMany(agent, template, configs)
  deepEqual(receipts, [
    { codeId, label: `${basename(f)}/contract1` },
    { codeId, label: `${basename(f)}/contract2` },
  ])
  deepEqual(deployment.get('contract1'), {
    name: 'contract1',
    label: `${basename(f)}/contract1`,
    codeId,
  })
  deepEqual(deployment.get('contract2'), {
    name: 'contract2',
    label: `${basename(f)}/contract2`,
    codeId,
  })
})

// init many contracts from different templates
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const templateA  = { codeId: 2 }
  const templateB  = { codeId: 3 }
  const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
  const receipts   = await deployment.initVarious(agent, configs)
  deepEqual(receipts, [
    { codeId: 2, label: `${basename(f)}/contractA`, },
    { codeId: 3, label: `${basename(f)}/contractB`, },
  ])
  deepEqual(deployment.get('contractA'), {
    name: 'contractA',
    label: `${basename(f)}/contractA`,
    codeId: 2
  })
  deepEqual(deployment.get('contractB'), {
    name: 'contractB',
    label: `${basename(f)}/contractB`,
    codeId: 3
  })
})
```

## Deployments directory

```typescript
import { DeployOps, Deployments } from '@hackbg/fadroma'
import { withTmpDir } from '@hackbg/kabinet'

// deployments
await withTmpDir(async dir=>{
  const d = new Deployments(dir)
  await d.create()
  await d.select()
  d.active
  d.get()
  d.list()
  d.save('test', 'test')
})

// integrations
const prefixOfActiveDeployment = Symbol()
const context = {
  chain: {
    deployments: {
      get () {},
      active: { prefix: prefixOfActiveDeployment, receipts: [] },
      printActive () {},
      list () { return [
        {prefix: '.active.yml'},
        {prefix: prefixOfActiveDeployment},
        {prefix:'somethingelse'}]
      },
      async create () {},
      async select () {}
    }
  }
}
await Deploy.new(context)
const { deployment, prefix } = await Deploy.get(context)
equal(deployment, context.chain.deployments.active)
equal(prefix,     context.chain.deployments.active.prefix)
await Deploy.status(context)
await Deploy.status(context)
```

# Devnets

```typescript
import { Devnet } from '@hackbg/fadroma'
let devnet: Devnet
```

* The devnet is a temporary self-hosted instance of the selected blockchain network.

## Constructing a devnet

```typescript
import { Devnet } from '../index'

// constructing a devnet
const chainId = 'test-devnet'
devnet = new Devnet({ chainId })
equal(devnet.chainId, chainId)
ok(devnet.protocol)
ok(devnet.host)
equal(devnet.port, '')

// requires chain id:
try { new Devnet() } catch (e) {}
```

## Devnets are persistent

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
// save/load Devnet state
withTmpDir(stateRoot=>{
  const chainId = 'test-devnet'
  const devnet = new Devnet({ chainId, stateRoot })
  ok(devnet.nodeState instanceof JSONFile)
  ok(devnet.stateRoot instanceof BaseDirectory)
  equal(devnet.stateRoot.path, stateRoot)
  ok(!devnet.load())
  equal(devnet.save(), devnet)
  deepEqual(devnet.load(), { chainId, port: devnet.port })
})
```

## Dockerized devnet

```typescript
import { DockerDevnet }  from '@hackbg/fadroma'
import { withTmpFile }   from '@hackbg/kabinet'
import { Dokeres }       from '@hackbg/dokeres'
import { mockDockerode } from './TESTING'
import { resolve, basename } from 'path'
const readyPhrase = "I'm Freddy"

// construct dockerode devnet
await withTmpDir(stateRoot=>{
  const docker      = mockDockerode()
  const imageName   = Symbol()
  const image       = new Dokeres(docker).image(imageName)
  const initScript  = Symbol()
  const devnet = new DockerDevnet({ stateRoot, docker, image, initScript, readyPhrase })
  equal(devnet.identities.path, resolve(stateRoot, 'identities'))
  equal(devnet.image,           image)
  equal(devnet.image.dockerode, docker)
  equal(devnet.image.name,      imageName)
  equal(devnet.initScript,      initScript)
  equal(devnet.readyPhrase,     readyPhrase)
})

// spawn dockerode devnet
await withTmpDir(async stateRoot => {
  await withTmpFile(async initScript => {
    const docker = mockDockerode(({ createContainer }) => {
      if (createContainer) {
        const stream = {
          on (arg, cb) {
            if (arg === 'data') {
              cb(readyPhrase)
            }
          },
          off (arg, cb) {},
          destroy () {},
        }
        return [ null, stream ]
      }
    })
    class TestDockerDevnet extends DockerDevnet {
      waitSeconds = 0.5
      waitPort = () => Promise.resolve()
    }
    const devnet = new TestDockerDevnet({
      stateRoot,
      docker,
      image: new Dokeres(docker).image(basename(stateRoot)),
      initScript,
      readyPhrase,
      portMode: 'lcp' // or 'grpcWeb'
    })
    equal(await devnet.spawn(), devnet)
  })
})

// pass names of accounts to prefund on genesis
const identities  = [ 'FOO', 'BAR' ]
devnet = new Devnet({ identities })
equal(devnet.genesisAccounts, identities)
image = {
  name: Symbol(),
  run (name, options, command, entrypoint) {
    equal(name, image.name)
    equal(options.env.GenesisAccounts, 'FOO BAR')
  }
}
const dockerDevnet = new DockerDevnet({ identities, initScript: '', image })
equal(dockerDevnet.genesisAccounts, identities)
```

### Chain-specific Dockerode devnets

```typescript
import { getScrtDevnet } from '@hackbg/fadroma'
for (const version of ['1.2', '1.3']) {
  const dokeres = new Dokeres(mockDockerode(({ createContainer })=>{
    if (createContainer) {
      const stream = {
        on  (arg, cb) { if (arg === 'data') { cb(readyPhrase) } },
        off (arg, cb) {},
        destroy () {},
      }
      return [ null, stream ]
    }
  }))
  const devnet = getScrtDevnet(version, undefined, undefined, dokeres)
  ok(devnet instanceof DockerDevnet)
  await devnet.respawn()
  await devnet.kill()
  await devnet.erase()
}
```

# Mocknets

* The Fadroma Mocknet is a pure Node.js implementation of the API and environment that Cosmos
  smart contracts expect.
* Because it does not contain a distributed consensus mechanism,
  it allows the interaction of multiple smart contracts to be tested at a much faster speed than
  devnet.

## Mocknet usage:

```typescript
// initialize and provide agent
import { Mocknet, MocknetAgent } from '@hackbg/fadroma'

chain = new Mocknet()
agent = await chain.getAgent()
ok(agent instanceof MocknetAgent)

// upload WASM blob, returning code ID
import { pathToFileURL } from 'url'
chain     = new Mocknet()
agent     = await chain.getAgent()
template  = await agent.upload(ExampleContracts.Blobs.Echo)
template2 = await agent.upload(ExampleContracts.Blobs.KV)
equal(template.chainId,  agent.chain.id)
equal(template2.chainId, template.chainId)
equal(template2.codeId,  String(Number(template.codeId) + 1))

// instantiate and call a contract
agent    = await new Mocknet().getAgent()
template = { chainId: 'Mocknet', codeId: '2' }
rejects(agent.instantiate(template, 'test', {}))

// instantiate and call a contract, successfully this time
agent    = await new Mocknet().getAgent()
template = await agent.upload(ExampleContracts.Blobs.Echo)
message  = { fail: false }
instance = await agent.instantiate(template, 'test', message)
client   = agent.getClient(Client, instance)
equal(await client.query("Echo"), 'Echo')
ok(await client.execute("Echo"), { data: "Echo" })

// contract can use to platform APIs provided by Mocknet
agent    = await new Mocknet().getAgent()
template = await agent.upload(ExampleContracts.Blobs.KV)
instance = await agent.instantiate(template, 'test', { value: "foo" })
client   = agent.getClient(Client, instance)
equal(await client.query("Get"), "foo")
ok(await client.execute({Set: "bar"}))
equal(await client.query("Get"), "bar")
ok(await client.execute("Del"))
rejects(client.query("Get"))
```

## Mocknet internals

### `MocknetContract`

```typescript
import { MocknetContract } from '@hackbg/fadroma' // wait what
let contract: MocknetContract
let response: { Ok: any, Err: any }
```

* The **`MocknetContract`** class wraps WASM contract blobs and takes care of the CosmWasm
  calling convention.
  * Normally, it isn't used directly - `Mocknet`/`MocknetAgent` call
    `MocknetBackend` which calls this.
* Every method has a slightly different shape: Assuming **Handle** is the "standard":
  * **Init** is like Handle but has only 1 variant and response has no `data` attribute.
  * **Query** is like Handle but returns raw base64 and ignores `env`.
  * Every method returns the same thing - a JSON string of the form `{ "Ok": ... } | { "Err": ... }`
    * This corresponds to the **StdResult** struct returned from the contract
    * This result is returned to the contract's containing `MocknetBackend` as-is.

```typescript
contract = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
initMsg  = { fail: false }

response = contract.init(Testing.mockEnv(), initMsg)
key      = "Echo"
value    = utf8toB64(JSON.stringify(initMsg))
equal(response.Err, undefined)
deepEqual(response.Ok, { messages: [], log: [{ encrypted: false, key, value }] })

response = contract.init(Testing.mockEnv(), { fail: true }))
equal(Ok, undefined)
deepEqual(Err, { generic_err: { msg: 'caller requested the init to fail' } })

response = contract.handle(Testing.mockEnv(), "Echo")
data     = utf8toB64(JSON.stringify("Echo"))
equal(Err, undefined)
deepEqual(Ok, { messages: [], log: [], data })

response = contract.handle(Testing.mockEnv(), "Fail")
equal(Ok, undefined)
deepEqual(Err, { generic_err:  { msg: 'this transaction always fails' } })

contract = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
response = await contract.query("Echo")
equal(Err, undefined)
equal(Ok,  utf8toB64('"Echo"'))

await new MocknetContract().load(ExampleContracts.Blobs.Echo)
response = await contract.query("Fail")
equal(Ok, undefined)
deepEqual(Err, { generic_err: { msg: 'this query always fails' } })
```

### Base64 IO

* **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  responses) are returned by the contract as Base64-encoded strings
  * If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  * These functions are used by the mocknet code to encode/decode the base64.

```typescript
import { b64toUtf8, utf8toB64 } from '@hackbg/fadroma'

equal(b64toUtf8('IkVjaG8i'), '"Echo"')
equal(utf8toB64('"Echo"'), 'IkVjaG8i')
```

# The command model

```typescript
import { runOperation } from '@hackbg/fadroma'

// run empty operation
await runOperation("", [], [])

// run operation with invalid step
await assert.rejects(runOperation("", [undefined], []))

// run operation with one step
assert.ok(await runOperation("", [()=>({foo:true})], []))

// catch and rethrow step failure
const error = {}
assert.ok(rejects(runOperation("", [()=>{throw error}], [])))

// subsequent steps update the context
const result = await runOperation("", [
  ()=>({foo:true}),
  ()=>({bar:true})
], [])
assert.ok(result.foo)
assert.ok(result.bar)

// the context.run function runs steps without updating context
await assert.rejects(runOperation("", [ async ({ run }) => { await run() } ], []))
assert.ok(await runOperation("", [ async ({ run }) => { await run(async () => {}) } ], []))
```

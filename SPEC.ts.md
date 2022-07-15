---
literate: typescript
---

# Fadroma Executable Specification

This file is a combination of spec and test suite.

You can read it if you want to become familiar with the operating model of the framework.

```typescript
import * as Fadroma from './fadroma'
import * as Testing from './TESTING'
```

# The tripartite model

## Chains

```typescript
import assert from 'assert'
const ChainSpec = {}
const test = tests => Object.assign(ChainSpec, tests)
export default ChainSpec
```

### Chain config

```typescript
import { Chain } from '../index'
test({
  'chain id' () {
    const chain = new Chain('chainid')
    assert(chain.id === 'chainid')
  },
  'chain API URL' () {
    const url = 'http://example.com'
    const chain = new Chain('chainid', { url })
    assert(chain.url === url)
  }
})
```

### Chain modes

```typescript
import { ChainMode, Agent } from '../index'
test({
  'mainnet' () {
    const mode = ChainMode.Mainnet
    const chain = new Chain('chainid', { mode })
    assert(chain.isMainnet)
    assert(!chain.isTestnet)
    assert(!chain.isDevnet)
  },
  'testnet' () {
    const mode = ChainMode.Testnet
    const chain = new Chain('chainid', { mode })
    assert(!chain.isMainnet)
    assert(chain.isTestnet)
    assert(!chain.isDevnet)
  },
  'devnet' () {
    const mode = ChainMode.Devnet
    const chain = new Chain('chainid', { mode })
    assert(!chain.isMainnet)
    assert(!chain.isTestnet)
    assert(chain.isDevnet)
  },
})
```

### Chain features

```typescript
test({
  'Chain#getNonce must be implemented in subclass' ({ throws }) {
    const chain = new Chain('chainid')
    throws(()=>chain.getNonce())
  },
  async 'Chain#getAgent takes name only on devnet' ({ rejects, equal }) {
    const agent = Symbol()
    class TestChain extends Chain {
      Agent = { async create () { return agent } }
    }
    const chain = new TestChain('chainid')
    await rejects(chain.getAgent({ name: 'agent' }))
    chain.node = { getGenesisAccount () { return {} } }
    equal(await chain.getAgent({ name: 'agent' }), agent)
  },
  async 'Chain#getAgent takes Identity object' ({ rejects, ok }) {
    class TestAgent extends Agent {
      static create (options) {
        return new this(options)
      }
    }
    class TestChain extends Chain {
      Agent = TestAgent
    }
    const chain = new TestChain('chainid')
    ok(await chain.getAgent({}) instanceof Agent)
  }
})
```

### Chain variants

* `LegacyScrt`: creates secretjs@0.17.5 based agent using lcd/amino
* `Scrt`: creates secretjs@beta based agent using grpc

```typescript
import { LegacyScrt, Scrt } from '../index'
for (const Chain of [
  LegacyScrt,
  Scrt
  /* add other supported chains here */
]) test({
  async [`${Chain.name}: mainnet`] ({ ok }) {
    ok(await new Chain('main', { mode: Chain.Mode.Mainnet }))
  },
  async [`${Chain.name}: testnet`] ({ ok }) {
    ok(await new Chain('test', { mode: Chain.Mode.Testnet }))
  },
  async [`${Chain.name}: devnet`] ({ ok, equal }) {
    const node = { chainId: 'scrt-devnet', url: 'http://test:0' }
    const chain = await new Chain('dev', { mode: Chain.Mode.Devnet, node })
    ok(chain)
    equal(chain.node, node)
    equal(chain.url,  node.url)
    equal(chain.id,   node.chainId)
  },
})
```

## Agent

The Agent class proxies the underlying API.

```typescript
const AgentSpec = {}
const test = tests => Object.assign(AgentSpec, tests)
export default AgentSpec
```

**TODO:** Reusable test suite for every agent subclass

### Base agent

```typescript
import { Agent } from '../index'

test({

  async "get balance for default denomination" ({ equal }) {
    const balances = { 'foo': '1', 'bar': '2' }
    class TestAgent extends Agent {
      defaultDenom = 'foo'
      getBalance (denom = this.defaultDenom) {
        return Promise.resolve(balances[denom] || '0')
      }
    }
    const agent = new TestAgent()
    equal(await agent.balance,           '1')
    equal(await agent.getBalance(),      '1')
    equal(await agent.getBalance('foo'), '1')
    equal(await agent.getBalance('bar'), '2')
    equal(await agent.getBalance('baz'), '0')
  },

  async "instantiate contract" ({ deepEqual }) {
    const instance = Symbol()
    const chainId  = Symbol()
    class TestAgent extends Agent {
      chain = { id: chainId }
      instantiate (template, label, msg, funds) {
        return {instance, template, label, msg, funds}
      }
    }
    const codeId   = Symbol()
    const template = {chainId, codeId}
    const label    = Symbol()
    const msg      = Symbol()
    const funds    = Symbol()
    const agent = new TestAgent()
    deepEqual(
      await agent.instantiate(template, label, msg, funds),
      {instance, template, label, msg, funds}
    )
  },

  async "execute tx" ({ ok }) {
    class TestAgent extends Agent {
      async execute (contract, msg) { return {} }
    }
    ok(await new TestAgent().execute())
  },

  async "query contract" ({ ok }) {
    class TestAgent extends Agent {
      async query (contract, msg) { return {} }
    }
    ok(await new TestAgent().query())
  },

})
```

### Chain-specific agents.

* `LegacyScrt.Agent` a.k.a. `LegacyScrtAgent`: uses secretjs 0.17.5
* `Scrt.Agent` a.k.a. `ScrtRPCAgent`: which uses the new gRPC API
  provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
  supported in secretjs 0.17.5 and older.

```typescript
import { toBase64, fromBase64, fromUtf8, fromHex } from '../index'
import { withMockAPIEndpoint } from './_Harness'

import { LegacyScrt, Scrt } from '../index'

for (const Chain of [
  LegacyScrt,
  Scrt
  /* add other supported chains here */
]) test({

  async [`${Chain.name}: from mnemonic`] ({ equal, deepEqual }) {
    const chain    = new Chain('test')
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent    = await chain.getAgent({ mnemonic })
    equal(agent.chain,    chain)
    equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    /*deepEqual(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv'
    })*/
  },

  async [`${Chain.name}: wait for next block`] ({ equal, deepEqual }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain    = new Chain('test', { url: endpoint.url })
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
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
  },

  async [`${Chain.name}: native token balance and transactions`] ({ equal }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain     = new Chain('test', { url: endpoint.url })
      const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
      const [agent1, agent2] = await Promise.all([
        chain.getAgent({mnemonic: mnemonic1}),
        chain.getAgent({mnemonic: mnemonic2}),
      ])
      endpoint.state.balances = { uscrt: { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") } }
      equal(await agent1.balance, "2000")
      equal(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      equal(await agent1.balance, "1000")
      equal(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      equal(await agent1.balance, "1500")
      equal(await agent2.balance, "3500")
    })
  },

  async [`${Chain.name}: full contract lifecycle`] ({ ok, equal, deepEqual }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain    = new Chain('test', { url: endpoint.url })
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const agent    = await chain.getAgent({ mnemonic })
      const location = 'fixtures/empty.wasm'
      const codeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      const artifact = { location, codeHash }
      const template = await agent.upload(artifact)
      equal(artifact.codeHash, template.codeHash)
      equal(template.codeId,   1)
      const label    = `contract_deployed_by_${agent.name}`
      const instance = await agent.instantiate(template, label, {})
      const { address } = instance
      ok(address, 'init tx returns contract address')
      console.debug(`test q ${address}`)
      throw 'TODO - how to decrypt/reencrypt query?'
      const queryResult = await agent.query({ address }, 'status')
      equal(queryResult, 'status')
      console.debug(`test tx ${address}`)
      const txResult = await agent.execute({ address }, 'tx', { option: "value" })
      deepEqual(txResult, {})
    })
  }

})
```

### Bundling transactions

```typescript
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

The Cosmos API allows for multiple messages to be sent as
part of the same transaction. However, `secretjs<=0.17.5`
did not expose this functionality, and every single thing
took 5 seconds. Hence, our TX bundling implementation.

#### Base bundle

```typescript
import { Bundle } from '../index'
test({
  async "tx bundles" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    const agent = new TestAgent()
    const bundle = agent.bundle()
    ok(bundle instanceof Bundle)
  },

  async "agent uses bundle to instantiate many contracts in 1 tx" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    await new TestAgent().instantiateMany([])
    await new TestAgent().instantiateMany([], 'prefix')
  },
})
```

##### Chain-specific bundles

```typescript
for (const Scrt of [ Scrt_1_2, Scrt_1_3 ]) test({
  async [`get ${Scrt.name}.Agent.Bundle from agent`] ({ ok }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent  = await Scrt_1_2.Agent.create({}, { mnemonic })
    const bundle = agent.bundle()
    ok(bundle instanceof Scrt_1_2.Agent.Bundle)
  }
})
```

## Clients

```typescript
const ClientSpec = {}
const test = tests => Object.assign(ClientSpec, tests)
export default ClientSpec
```

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
import { Agent, Client } from '../index'
test({
  'to create a Client you need an Agent' ({ ok }) {
    ok(new Client(new Agent(), {}))
  }
})
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
for (const Gas of [LegacyScrtGas, ScrtGas]) test({

  [`${Gas.name}: scrt gas unit is uscrt`] ({ equal }) {
    equal(ScrtGas.denom, 'uscrt')
  },

  [`${Gas.name}: default gas fees are set`] ({ ok }) {
    ok(ScrtGas.defaultFees.upload instanceof ScrtGas)
    ok(ScrtGas.defaultFees.init   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.exec   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.send   instanceof ScrtGas)
  },

  [`${Gas.name}: can create custom gas fee specifier`] ({ deepEqual }) {
    const fee = new ScrtGas(123)
    deepEqual(fee.amount, [{amount: '123', denom: 'uscrt'}])
  }

})
```

# The operations model

## Building

```typescript
import assert from 'assert'
const BuildSpec = {}
const test = tests => Object.assign(BuildSpec, tests)
export default BuildSpec
```

```typescript
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const here      = dirname(fileURLToPath(import.meta.url))
const workspace = resolve(here, '../fixtures')
```

### The `Source` class

```typescript
import { Source } from '../index'
test({
  async 'Source ctor positional args' () {
    const source = new Source('w', 'c', 'r')
    assert(source.workspace === 'w')
    assert(source.crate     === 'c')
    assert(source.ref       === 'r')
  },
  async 'Source.collectCrates' () {
    const sources = Source.collectCrates('w', ['c1', 'c2'])('test')
    assert(sources.c1.workspace === 'w')
    assert(sources.c1.crate     === 'c1')
    assert(sources.c1.ref       === 'test')
    assert(sources.c2.workspace === 'w')
    assert(sources.c2.crate     === 'c2')
    assert(sources.c2.ref       === 'test')
  }
})
```

### The base `Builder` class

```typescript
import { Builder, Artifact } from '../index'
class TestBuilder extends Builder {
  async build (source: Source): Promise<Artifact> {
    return { location: '', codeHash: '', _fromSource: source }
  }
}
test({
  async 'Builder#build' () {
    const source = {}
    const artifact = await new TestBuilder().build(source)
    assert(artifact._fromSource === source)
  },
  async 'Builder#buildMany' () {
    const sources = [{}, {}, {}]
    const artifacts = await new TestBuilder().buildMany(sources)
    assert(artifacts[0]._fromSource === sources[0])
    assert(artifacts[1]._fromSource === sources[1])
    assert(artifacts[2]._fromSource === sources[2])
  },
})
```

```typescript
import { Builder } from '../index'
test({
  async 'Builder#buildMany' ({deepEqual}) {
    class TestBuilder extends Builder {
      async build (source, args) { return { built: true, source, args } }
    }
    const source1 = Symbol()
    const source2 = Symbol()
    const args = [Symbol(), Symbol()]
    deepEqual(
      await new TestBuilder().buildMany([source1, source2], args),
      [
        { built: true, source: source1, args },
        { built: true, source: source2, args }
      ]
    )
  }
})
```

#### Build caching

The `CachingBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { CachingBuilder } from '../index'
test({
  'CachingBuilder#prebuild' ({ equal, throws }) {
    class TestCachingBuilder extends CachingBuilder {
      async build (source) { return {} }
    }
    const workspace = 'foo'
    throws(()=>new TestCachingBuilder().prebuild({}))
    equal(new TestCachingBuilder().prebuild({workspace}), null)
  }
})
```

#### Raw builder

```typescript
import { RawBuilder } from '../index'
test({
  async 'RawBuilder' ({ deepEqual }) {
    let ran
    class TestRawBuilder extends RawBuilder {
      run = (...args) => ran.push(args)
    }

    const buildScript    = Symbol()
    const checkoutScript = Symbol()
    const builder = new TestRawBuilder(buildScript, checkoutScript)

    const here      = dirname(fileURLToPath(import.meta.url))
    const crate     = 'empty'
    const ref       = 'ref'

    ran = []
    const sourceFromHead   = { workspace, crate }
    const templateFromHead = await builder.build(sourceFromHead)
    deepEqual(ran, [[buildScript, []]])

    ran = []
    const sourceFromRef   = { workspace, crate, ref }
    const templateFromRef = await builder.build(sourceFromRef)
    deepEqual(ran, [[checkoutScript, [ref]], [buildScript, []]])
  }
})
```

#### Dockerized builder

```typescript
import { DockerBuilder } from '../index'
import { Dokeres, DokeresImage } from '@hackbg/dokeres'
import { mockDockerode } from './_Harness'
import { Transform } from 'stream'
test({
  async 'DockerBuilder' ({ ok, equal, deepEqual }) {
    class TestDockerBuilder extends DockerBuilder {
      prebuild (source) { return false }
    }
    class TestDokeresImage extends DokeresImage {
      async ensure () { return theImage }
    }
    const theImage  = Symbol()
    const crate     = 'empty'
    const source    = { workspace, crate }
    const ran       = []
    const docker    = mockDockerode(runCalled)
    const image     = new Dokeres(docker).image(' ')
    const script    = "build.sh"
    const options   = { docker, image, script }
    const builder   = new TestDockerBuilder(options)
    const artifact  = await builder.build({ workspace, crate })
    equal(artifact.location, resolve(workspace, 'artifacts/empty@HEAD.wasm'))
    equal(artifact.codeHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

    function runCalled ({ run: [image, cmd, buildLogs, args] }) {
      equal(image, theImage)
      equal(cmd, `bash /build.sh HEAD empty`)
      ok(buildLogs instanceof Transform)
      equal(args.Tty, true)
      equal(args.AttachStdin: true)
      deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
      ok(args.HostConfig.Binds instanceof Array)
      equal(args.HostConfig.AutoRemove, true)
    }
  }
  async 'DockerBuilder#buildMany' () {
    class TestDockerBuilder extends DockerBuilder {
      prebuild (source) { return false }
    }
    class TestDokeresImage extends DokeresImage {
      async ensure () { return theImage }
    }
    const theImage  = Symbol()
    const docker    = mockDockerode()
    const image     = new Dokeres(docker).image(' ')
    const script    = ''
    const options   = { docker, image, script }
    const builder   = new TestDockerBuilder(options)
    const artifacts = await builder.buildMany([
      { workspace, crate: 'crate1' }
      { workspace, ref: 'HEAD', crate: 'crate2' }
      { workspace, ref: 'asdf', crate: 'crate3' }
    ])
  }
})
```

### Builders for Secret Network

```typescript
import { getScrtBuilder } from '../index'
test({
  'get dockerode builder' ({ ok }) {
    ok(getScrtBuilder())
  },
  'get raw builder' ({ ok }) {
    ok(getScrtBuilder({ raw: true }))
  },
})
```

## Uploading

```typescript
const UploadSpec = {}
const test = tests => Object.assign(UploadSpec, tests)
export default UploadSpec
```

### Basic uploader

```typescript
import { pathToFileURL } from 'url'
const emptyContract = pathToFileURL(fixture('examples/empty-contract/artifacts/empty@HEAD.wasm'))

import { FSUploader } from '../index'
import { fixture } from './_Harness'
test({
  'construct FSUploader' ({ ok }) {
    const agent = Symbol()
    const uploader = new FSUploader(agent)
    ok(uploader.agent === agent)
  },
  async 'FSUploader#upload' ({ deepEqual }) {
    const artifact        = { url: emptyContract }
    const chainId         = Symbol()
    const codeId          = Symbol()
    const codeHash        = Symbol()
    const transactionHash = Symbol()
    const template = { chainId, codeId, codeHash, transactionHash }
    const agent = {
      chain:     { id: chainId },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
    const result   = await uploader.upload(artifact)
    deepEqual(result, template)
  },
  async 'FSUploader#uploadMany' ({ deepEqual }) {
    const artifact = { url: emptyContract }
    const template = Symbol()
    const agent = {
      chain:     { id: Symbol() },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
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
  }
})
```

### Caching

```typescript
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { CachingFSUploader } from '../index'
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
})

test({
  'add CachingFSUploader to operation context' ({ ok }) {
    const agent = { chain: { uploads: Symbol() } }
    const cache = Symbol()
    const uploader = new CachingFSUploader(agent, cache)
    ok(uploader.agent === agent)
  },
  async 'upload 1 artifact with CachingFSUploader#upload' ({ ok }) {
    await withTmpDir(async cacheDir=>{
      const agent = mockAgent()
      const cache = new Path(cacheDir).in('uploads').as(JSONDirectory)
      const uploader = new CachingFSUploader(agent, cache)
      await withTmpFile(async location=>{
        const url = pathToFileURL(location)
        ok(await uploader.upload({url}))
      })
    })
  },
  async 'upload any number of artifacts with CachingFSUploader#uploadMany' ({ ok }) {
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
  },
})
```

### Upload receipts directory

```typescript
import { Uploads } from '../index'
```

## Deployment

```typescript
const DeploySpec = {}
const test = tests => Object.assign(DeploySpec, tests)
export default DeploySpec
```

### Deployment

```typescript
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { Deployment } from '../index'
test({
  'Deployment get/set/load/save' ({ ok, equal, deepEqual, throws }) {
    withTmpFile(f=>{
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
  },
  async 'Deployment#init' ({ equal, deepEqual }) {
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
  },
  async 'Deployment#initMany' ({ equal, deepEqual }) {
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
  },
  async 'Deployment#initVarious' ({ equal, deepEqual }) {
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
  },

})

const mockAgent = () => ({
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
```

### Deployments directory

```typescript
import { DeployOps, Deployments } from '../index'
import { withTmpDir } from '@hackbg/kabinet'
test({
  async 'Deployments' () {
    await withTmpDir(async dir=>{
      const d = new Deployments(dir)
      await d.create()
      await d.select()
      d.active
      d.get()
      d.list()
      d.save('test', 'test')
    })
  },
  async 'Deployments integrations' ({ equal }) {
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
    await DeployOps.New(context)
    const { deployment, prefix } = await DeployOps.Append(context)
    equal(deployment, context.chain.deployments.active)
    equal(prefix,     context.chain.deployments.active.prefix)
    await DeployOps.Status(context)
    await DeployOps.Status(context)
  }
})
```

# Devnets

The devnet is a temporary local server which simulates
the behavior of a single-node blockchain network.

```typescript
import assert from 'assert'
const DevnetSpec = {}
const test = tests => Object.assign(DevnetSpec, tests)
export default DevnetSpec
```

### Constructing a devnet

```typescript
import { Devnet } from '../index'

test({
  'construct devnet' ({ ok, equal }) {
    const chainId = 'test-devnet'
    const devnet = new Devnet({ chainId })
    equal(devnet.chainId, chainId)
    ok(devnet.protocol)
    ok(devnet.host)
    equal(devnet.port, '')
  },
  'construct devnet requires chain id' ({ throws }) {
    try { // FIXME: for some reason assert.throws doesn't work
      new Devnet()
    } catch (e) {
      return // ok
    }
    ok(false, 'threw')
  }
})
```

### Devnets are persistent

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
test({
  async 'save/load Devnet state' ({ ok, equal, deepEqual }) {
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
  }
})
```

### Dockerized devnet

```typescript
import { DockerDevnet } from '../index'
import { mockDockerode } from './_Harness'
import { resolve, basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { Dokeres } from '@hackbg/dokeres'
const readyPhrase = "I'm Freddy"
test({

  'construct dockerode devnet' ({ ok, equal }) {
    withTmpDir(stateRoot=>{
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
  },

  async 'spawn dockerode devnet' ({ equal }) {
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
  },

  'pass names of accounts to prefund on genesis' ({ equal, ok }) {
    const identities  = [ 'FOO', 'BAR' ]
    const devnet = new Devnet({ identities })
    equal(devnet.genesisAccounts, identities)
    const image = {
      name: Symbol(),
      run (name, options, command, entrypoint) {
        equal(name, image.name)
        equal(options.env.GenesisAccounts, 'FOO BAR')
      }
    }
    const dockerDevnet = new DockerDevnet({ identities, initScript: '', image })
    equal(dockerDevnet.genesisAccounts, identities)
  }

})
```

#### Chain-specific Dockerode devnets

```typescript
import { getScrtDevnet } from '../index'
for (const version of ['1.2', '1.3']) test({
  async [`${version}: get scrt devnet`] ({ ok }) {
    const dokeres = new Dokeres(mockDockerode(({ createContainer })=>{
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
    }))
    const devnet = getScrtDevnet(version, undefined, undefined, dokeres)
    ok(devnet instanceof DockerDevnet)
    await devnet.respawn()
    await devnet.kill()
    await devnet.erase()
  },
})
```

### Managed devnet

#### Chain-specific managed devnets

```typescript
import { ManagedDevnet } from '../index'
import { mockDevnetManager } from './_Harness'
for (const version of ['1.2', '1.3']) test({
  async [`${version}: get managed scrt devnet`] ({ ok }) {
    const manager = await mockDevnetManager()
    try {
      const devnet = getScrtDevnet(version, manager.url)
      ok(devnet instanceof ManagedDevnet)
      await devnet.respawn()
      console.info('Respawned')
      await devnet.save()
    } catch (e) {
      console.warn(e) // TODO use whole devnet manager with mocked devnet init
    } finally {
      manager.close()
    }
  },
})
```

# Mocknets

The Fadroma Mocknet is a pure JS implementation of the
API and environment that Cosmos smart contracts expect.
It does not contain a distributed consensus mechanism,
which enables smart contract-based programs to be executed in isolation.

```typescript
const MocknetSpec = {}
const test = tests => Object.assign(MocknetSpec, tests)
export default MocknetSpec
```

### Example contracts

Testing of the mocknet is conducted via two minimal smart contracts.
Compiled artifacts of those are stored under [`/fixtures`](../fixtures).
You can recompile them with the Fadroma Build CLI.

> See **[../examples/README.md]** for build instructions.

```typescript
import { fixture } from './_Harness'
import { readFileSync } from 'fs'
export const ExampleContracts = { Paths: {}, Blobs: {} }
```

#### Echo contract

This parrots back the data sent by the client, in order to validate
reading/writing and serializing/deserializing the input/output messages.

```typescript
ExampleContracts.Paths.Echo = fixture('fixtures/fadroma-example-echo@HEAD.wasm')
ExampleContracts.Blobs.Echo = readFileSync(ExampleContracts.Paths.Echo)
```

### KV contract

This exposes the key/value storage API available to contracts,
in order to validate reading/writing and serializing/deserializing stored values.

```typescript
ExampleContracts.Paths.KV = fixture('fixtures/fadroma-example-kv@HEAD.wasm')
ExampleContracts.Blobs.KV = readFileSync(ExampleContracts.Paths.KV)
```

### Mocking the environment

When testing your own contracts with Fadroma Mocknet, you are responsible
for providing the value of the `env` struct seen by the contracts.
Since here we test the mocknet itself, we use this pre-defined value:

```typescript
import { randomBech32 } from '@hackbg/formati'
const mockEnv = () => {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = randomBech32('mocked')
  const address  = randomBech32('mocked')
  return {
    block:    { height, time, chain_id }
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}
```

### Tests of public API

#### Can initialize and provide agent

```typescript
import { Mocknet, MocknetAgent } from '../index'
test({
  async "Mocknet: can initialize and create MocknetAgent" ({ ok }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    ok(agent instanceof MocknetAgent)
  }
})
```

#### Can upload WASM blob, returning code ID

```typescript
import { pathToFileURL } from 'url'
test({
  async 'MocknetAgent: can upload wasm blob, returning code id' ({ equal }) {
    const agent     = await new Mocknet().getAgent()
    const template  = await agent.upload(ExampleContracts.Blobs.Echo)
    equal(template.chainId, agent.chain.id)
    const template2 = await agent.upload(ExampleContracts.Blobs.Echo)
    equal(template2.chainId, template.chainId)
    equal(template2.codeId, String(Number(template.codeId) + 1))
  }
})
```

#### Can instantiate and call a contract

```typescript
import { Client } from '../index'
test({
  async 'MocknetAgent: contract init from missing code ID fails' ({ rejects }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    rejects(agent.instantiate(template, 'test', {}))
  },
  async 'MocknetAgent: contract upload and init/query/execute' ({ ok, equal }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const template = await agent.upload(ExampleContracts.Blobs.Echo)
    const message  = { fail: false }
    const instance = await agent.instantiate(template, 'test', message)
    const client   = agent.getClient(Client, instance)
    equal(await client.query("Echo"), 'Echo')
    ok(await client.execute("Echo"), { data: "Echo" })
  }
})
```

#### Contract deployed to mocknet can use simulated platform APIs

```typescript
test({
  async 'MocknetAgent: contract supports db_read/write/remove' ({ ok, equal, rejects }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const template = await agent.upload(ExampleContracts.Blobs.KV)
    const instance = await agent.instantiate(template, 'test', { value: "foo" })
    const client   = agent.getClient(Client, instance)
    equal(await client.query("Get"), "foo")
    ok(await client.execute({Set: "bar"}))
    equal(await client.query("Get"), "bar")
    ok(await client.execute("Del"))
    rejects(client.query("Get"))
  }
})
```

### Tests of internals

#### Base64 decoding

Fields that are of type `Binary` (query responses and the `data` field of handle responses)
are returned by the contract as Base64-encoded strings. This function decodes them.

> If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.

```typescript
import { b64toUtf8, utf8toB64 } from '../packages/ops/Mocknet'
test({
  'b64toUtf8' ({ equal }) {
    equal(b64toUtf8('IkVjaG8i'), '"Echo"')
  },
  'utf8toB64' ({ equal }) {
    equal(utf8toB64('"Echo"'), 'IkVjaG8i')
  }
})
```

#### MocknetContract

The `MocknetContract` class calls methods on WASM contract blobs.
Normally, it isn't used directly - `Mocknet`/`MocknetAgent` call
`MocknetBackend` which calls this.

* Every method has a slightly different shape:
  * Assuming **Handle** is the "standard":
  * **Init** is like Handle but has only 1 variant and response has no `data` attribute.
  * **Query** is like Handle but returns raw base64 and ignores `env`.
* Every method returns the same thing - a JSON string of the form `{ "Ok": ... } | { "Err": ... }`
  * This corresponds to the **StdResult** struct returned from the contract
  * This result is returned to the contract's containing `MocknetBackend` as-is.

```typescript
import { MocknetContract } from '../index' // wait what
test({

  async "MocknetContract#init   -> Ok" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const initMsg     = { fail: false }
    const { Ok, Err } = contract.init(mockEnv(), initMsg)
    const key         = "Echo"
    const value       = utf8toB64(JSON.stringify(initMsg))
    equal(Err, undefined)
    deepEqual(Ok, { messages: [], log: [{ encrypted: false, key, value }] })
  },

  async "MocknetContract#init   -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.init(mockEnv(), { fail: true })
    equal(Ok, undefined)
    deepEqual(Err, { generic_err: { msg: 'caller requested the init to fail' } })
  },

  async "MocknetContract#handle -> Ok" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.handle(mockEnv(), "Echo")
    const data        = utf8toB64(JSON.stringify("Echo"))
    equal(Err, undefined)
    deepEqual(Ok, { messages: [], log: [], data })
  },

  async "MocknetContract#handle -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.handle(mockEnv(), "Fail")
    equal(Ok, undefined)
    deepEqual(Err, { generic_err:  { msg: 'this transaction always fails' } })
  },

  async "MocknetContract#query  -> Ok" ({ equal }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = await contract.query("Echo")
    equal(Err, undefined)
    equal(Ok,  utf8toB64('"Echo"'))
  },

  async "MocknetContract#query  -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = await contract.query("Fail")
    equal(Ok, undefined)
    deepEqual(Err, { generic_err: { msg: 'this query always fails' } })
  }

})
```

# The command model

```typescript
import assert from 'assert'
const OperateSpec = {}
const test = tests => Object.assign(OperateSpec, tests)
export default OperateSpec
```

```typescript
import { runOperation } from '../index'
test({
  async 'run empty migration' () {
    const result = await runOperation("", [], [])
  },
  async 'run migration with falsy step' ({ rejects }) {
    rejects(runOperation("", [undefined], []))
  },
  async 'run migration with one step' ({ ok }) {
    const result = await runOperation("", [()=>({foo:true})], [])
    ok(result.foo)
  }
  async 'catch and rethrow step failure' ({ rejects }) {
    const error = {}
    await rejects(runOperation("", [()=>{throw error}], []))
  },
  async 'subsequent steps update the context' ({ ok }) {
    const result = await runOperation("", [
      ()=>({foo:true}),
      ()=>({bar:true})
    ], [])
    ok(result.foo)
    ok(result.bar)
  },
  async 'the context.run function runs steps without updating context' ({ rejects, ok }) {
    await rejects(runOperation("", [ async ({ run }) => { await run() } ], []))
    ok(await runOperation("", [ async ({ run }) => { await run(async () => {}) } ], []))
  },
})
```

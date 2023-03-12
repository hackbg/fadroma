# Fadroma Core Specification

## Introduction

This is the portable core of the Fadroma dApp framework.

* It is **portable**, in the sense that it should not depend on any features
  that are specific to a particular scripting runtime. Also known as
  **isomorphic JavaScript**.

* And it is the **core module**, because it contains the core abstractions
  of the Fadroma object model. All other NPM packages in the Fadroma ecosystem
  build upon this one, and probably do one of the following:
  * Provide platform-specific implementations of these abstractions
    (such as an Agent that is specifically for the Secret Network,
    or a Builder that executes builds specifically in a Docker container), or
  * Build atop the abstract object model to deliver new features with
    the appropriate degree of cross-platform support.

## The Fadroma Agent API

The **Fadroma Agent API** consists of the abstract `Chain`, `Agent`, and `Bundle` classes.
These classes are used when interacting with existing smart contracts.
`@fadroma/scrt` provides their concrete implementations for using Secret Network.

### Chain: connecting

The `Chain` object identifies what chain to connect to -
such as the Secret Network mainnet or testnet.

```typescript
import { Chain } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
assert(chain.id   === 'id')
assert(chain.url  === 'example.com')
assert(chain.mode === 'mainnet')
```

Chains can be in several `mode`s, enumerated by `ChainMode` a.k.a. `Chain.Mode`:

* **Mocknet** is a fast, nodeless way of executing contract code
  in the local JS WASM runtime.
* **Devnet** uses a real chain node, booted up temporarily in
  a local environment.
* **Testnet** is a persistent remote chain used for testing.
* **Mainnet** is the production chain where value is stored.

The `Chain#devMode` flag is true if you are able to restart
the chain and start over (i.e. when using a devnet or mocknet).

```typescript
chain.mode = 'mainnet'
assert(chain.devMode === false)
assert(chain.isMainnet)

chain.mode = 'testnet'
assert(chain.devMode === false)
assert(chain.isTestnet)
assert(!chain.isMainnet)

chain.mode = 'localnet'
assert(chain.devMode === true)
assert(chain.isLocalnet)
assert(!chain.isMainnet)

chain.mode = 'mocknet'
assert(chain.devMode === true)
assert(chain.isMocknet)
assert(!chain.isMainnet)
```

* Since the workflow is request-based, no persistent connection is maintained.

### Agent: identifying

To transact on a [chain](./Chains.ts.md), you need to authenticate
with your identity (account, wallet). To do that, you obtain an
`Agent` from the `Chain` using `Chain#getAgent({ mnemonic })`.

If you don't pass a mnemonic, a random mnemonic and address will be generated.

```typescript
import { Agent } from '@fadroma/core'
let agent: Agent = await chain.getAgent()
assert(agent instanceof Agent)
assert(agent.chain === chain)
assert(agent.mnemonic)
assert(agent.address)
```

### Block height

Now that you have an `Agent`, you can start doing things on the `Chain`.
The simplest thing to do is nothing: in this case, waiting until the
block height increments.

* On Secret Network, this can be necessary for uploading multiple contracts.

```typescript
const height = await agent.height // Get the current block height
await agent.nextBlock             // Wait for the block height to increment
assert(await agent.height === height + 1)
```

### Native token transactions

You're not on the chain to wait around, though.
The simplest operation you can conduct is transact with native tokens:

```typescript
await agent.balance             // In the default native token
await agent.getBalance()        // In the default native token
await agent.getBalance('token') // In a non-default native token

// Sending the default native token:
await agent.send('recipient-address', 1000)
await agent.send('recipient-address', '1000')

// Sending a non-default native token:
await agent.send('recipient-address', [{denom:'token', amount: '1000'}])
```

### Gas fees

Transacting creates load on the network, which incurs costs on node operators.
Compensations for transactions are represented by the gas metric.

```typescript
import { Fee } from '.'
```

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

### Uploading a contract

```typescript
// Uploading a single piece of code:
await agent.upload('example.wasm')
await agent.upload(readFileSync('example.wasm'))
await agent.upload({ artifact: './example.wasm', codeHash: 'expectedCodeHash' })

// Uploading multiple pieces of code:
await agent.uploadMany([
  'example.wasm',
  readFileSync('example.wasm'),
  { artifact: './example.wasm', codeHash: 'expectedCodeHash' }
])
```

### Instantiating a contract

```typescript
// Instantiating a single contract:
await agent.instantiate({
  codeId:  '1',
  label:   'unique contract label',
  initMsg: { parameters: 'values' }
})

// Instantiating multiple contracts in a single transaction:
await agent.instantiateMany([
  { codeId: '2', label: 'unique contract label 2', initMsg: { parameters: 'values' } },
  { codeId: '3', label: 'unique contract label 3', initMsg: { parameters: 'values' } }
})
```

### Querying contracts

```typescript
await agent.query({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
```

### Executing contract transactions

```typescript
// Executing a single transaction
await agent.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })

// Broadcasting multiple execute calls as a single transaction message
await agent.bundle().wrap(bundle=>{
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
})
```

### Transaction bundling

To submit multiple messages as a single transaction, you can
use Bundles.
  * A `Bundle` is a special kind of `Agent` that
    does not broadcast messages immediately.
  * Instead, messages are collected inside the bundle until
    the caller explicitly submits them.
  * Bundles can also be saved for manual signing of multisig
    transactions

```typescript
import { Chain, Agent, Bundle } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
let agent: Agent = await chain.getAgent()
let bundle: Bundle
class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}
```

A `Bundle` is designed to serve as a stand-in for its corresponding
`Agent`, and therefore implements the same API methods.
  * However, some operations don't make sense in the middle of a Bundle.
  * Most importantly, querying any state from the chain
    must be done either before or after the bundle.
  * Trying to query state from a `Bundle` agent will fail.

```typescript
import { Client } from '.'
bundle = new Bundle({ chain: {}, checkHash () { return 'hash' } })

assert(bundle.getClient(Client, '') instanceof Client)
assert.equal(await bundle.execute({}), bundle)
assert.equal(bundle.id, 1)
//assert(await bundle.instantiateMany({}, []))
//assert(await bundle.instantiateMany({}, [['label', 'init']]))
//assert(await bundle.instantiate({}, 'label', 'init'))
assert.equal(await bundle.checkHash(), 'hash')

assert.rejects(()=>bundle.query())
assert.rejects(()=>bundle.upload())
assert.rejects(()=>bundle.uploadMany())
assert.rejects(()=>bundle.sendMany())
assert.rejects(()=>bundle.send())
assert.rejects(()=>bundle.getBalance())
assert.throws(()=>bundle.height)
assert.throws(()=>bundle.nextBlock)
assert.throws(()=>bundle.balance)
```

To create and submit a bundle in a single expression,
you can use `bundle.wrap(async (bundle) => { ... })`:

```typescript
assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}), 'submitted')

assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}, undefined, true), 'saved')
```

```typescript
bundle = new TestBundle(agent)
assert.deepEqual(bundle.msgs, [])
assert.equal(bundle.id, 0)
assert.throws(()=>bundle.assertMessages())

bundle.add({})
assert.deepEqual(bundle.msgs, [{}])
assert.equal(bundle.id, 1)
assert.ok(bundle.assertMessages())
```

```typescript
bundle = new TestBundle(agent)
assert.equal(await bundle.run(""),       "submitted")
assert.equal(await bundle.run("", true), "saved")
assert.equal(bundle.depth, 0)

bundle = bundle.bundle()
assert.equal(bundle.depth, 1)
assert.equal(await bundle.run(), null)
```

```typescript
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
assert(bundle instanceof Bundle)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
//await agent.instantiateMany(new Contract(), [])
//await agent.instantiateMany(new Contract(), [], 'prefix')
```

## The Fadroma Ops API

The **Fadroma Ops API** consists of the abstract `Builder`, `Uploader`, `Deployment`
and `DeployStore` classes. Concrete implementations of those are provided in `@fadroma/build`
and `@fadroma/deploy`. These classes are used when deploying new smart contracts from source.

### Describing and deploying contracts

  * [Labels](./core-upload.spec.ts.md)
  * [Code hashes](./core-upload.spec.ts.md)
  * [Clients](./core-client.spec.ts.md)
  * [Contracts](./core-contract.spec.ts.md)
  * [Deployments](./core-deploy.spec.ts.md)
  * [Builders](./core-build.spec.ts.md)
  * [Uploaders](./core-upload.spec.ts.md)

```typescript
context.command('contract',
  'test the contract ops primitives',
  async () => {
    await import('./core-contract.spec.ts.md')
    await import('./core-client.spec.ts.md')
    await import('./core-build.spec.ts.md')
    await import('./core-code.spec.ts.md')
    await import('./core-upload.spec.ts.md')
    await import('./core-labels.spec.ts.md')
  })
```

```typescript
const contract = { address: 'addr' }
const agent = { getHash: async x => 'hash', getCodeId: async x => 'id' }
```

### Contract labels

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

```typescript
import { fetchLabel, parseLabel, writeLabel } from '@fadroma/core'

let c = { address: 'addr' }
let a = { getLabel: () => Promise.resolve('label') }
assert.ok(await fetchLabel(c, a))
assert.ok(await fetchLabel(c, a, 'label'))
assert.rejects(fetchLabel(c, a, 'unexpected'))
```

### Code ids

The code ID is a unique identifier for compiled code uploaded to a chain.

```typescript
import { fetchCodeId } from '@fadroma/core'

assert.ok(await fetchCodeId(contract, agent))
assert.ok(await fetchCodeId(contract, agent, 'id'))
assert.rejects(fetchCodeId(contract, agent, 'unexpected'))
```

### Code hashes

The code hash also uniquely identifies for the code that underpins a contract.
However, unlike the code ID, which is opaque, the code hash corresponds to the
actual content of the code. Uploading the same code multiple times will give
you different code IDs, but the same code hash.

```typescript
import { fetchCodeHash, assertCodeHash, codeHashOf } from '@fadroma/core'

assert.ok(assertCodeHash({ codeHash: 'hash' }))
assert.throws(()=>assertCodeHash({}))

assert.ok(await fetchCodeHash(contract, agent))
assert.ok(await fetchCodeHash(contract, agent, 'hash'))
assert.rejects(fetchCodeHash(contract, agent, 'unexpected'))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

### Inter-contract communication

```typescript
import { templateStruct, linkStruct } from '@fadroma/core'
assert.deepEqual(
  templateStruct({ codeId: '123', codeHash: 'hash'}),
  { id: 123, code_hash: 'hash' }
)
assert.deepEqual(
  linkStruct({ address: 'addr', codeHash: 'hash'}),
  { address: 'addr', code_hash: 'hash' }
)
```

## Error types

The `ClientError` class, based on `@hackbg/oops`, defines
custom error subclasses for various error conditions.

```typescript
// Make sure each error subclass can be created with no arguments:
import { ClientError } from './core-events'
for (const subtype of [
  'Unimplemented',
  'UploadFailed',
  'InitFailed',
  'CantInit_NoName',
  'CantInit_NoAgent',
  'CantInit_NoCodeId',
  'CantInit_NoLabel',
  'CantInit_NoMessage',

  'BalanceNoAddress',
  'DeployManyFailed',
  'DifferentHashes',
  'EmptyBundle',
  'ExpectedAddress',
  'ExpectedAgent',
  'InvalidLabel',
  'InvalidMessage',
  'LinkNoAddress',
  'LinkNoCodeHash',
  'LinkNoTarget',
  'NameOutsideDevnet',
  'NoAgent',
  'NoArtifact',
  'NoArtifactURL',
  'NoBuilder',
  'NoBuilderNamed',
  'NoBundleAgent',
  'NoChain',
  'NoChainId',
  'NoCodeHash',
  'NoContext',
  'NoCrate',
  'NoCreator',
  'NoDeployment',
  'NoName',
  'NoPredicate',
  'NoSource',
  'NoTemplate',
  'NoUploader',
  'NoUploaderAgent',
  'NoUploaderNamed',
  'NoVersion',
  'NotFound',
  'NotInBundle',
  'ProvideBuilder',
  'ProvideUploader',
  'Unpopulated',
  'ValidationFailed'
]) {
  assert(new ClientError[subtype]() instanceof ClientError)
}
```

## Log events

The `ClientConsole` class, based on `@hackbg/logs`, collects all logging output in one place.
In the future, this will enable semantic logging and/or GUI notifications.

```typescript
// Make sure each log message can be created with no arguments:
import { ClientConsole } from './core-events'
const log = new ClientConsole()

log.object()
log.object({foo:'bar',baz(){},quux:[],xyzzy:undefined,fubar:{}})

log.deployment()
log.deployment({ state: { foo: {}, bar: {} } })

log.chainStatus({})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] } }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] }, active: { name: 4 } }
})

log.receipt()
log.foundDeployedContract()
log.beforeDeploy()
log.afterDeploy()
log.deployFailed()
log.deployManyFailed()
log.deployFailedContract()
log.chainStatus()
log.confirmCodeHash()
log.waitingForNextBlock()

log.warnUrlOverride()
log.warnIdOverride()
log.warnNodeNonDevnet()
log.warnNoAgent()
log.warnNoAddress()
log.warnNoCodeHash()
log.warnNoCodeHashProvided()
log.warnCodeHashMismatch()
log.warnEmptyBundle()
```

## Utilities

### Lazy evaluation

### Generic collections

```typescript
import { into, intoArray, intoRecord } from '@fadroma/core'

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
```

### Validation against expected value

Case-insensitive.

```typescript
import { validated } from '@fadroma/core'
assert.ok(validated('test', 1))
assert.ok(validated('test', 1, 1))
assert.ok(validated('test', 'a', 'A'))
assert.throws(()=>validated('test', 1, 2))
assert.throws(()=>validated('test', 'a', 'b'))
```

### Overrides and fallbacks

Only work on existing properties.

```typescript
import { override, fallback } from '@fadroma/core'
assert.deepEqual(
  override({ a: 1, b: 2 }, { b: 3, c: 4 }),
  { a: 1, b: 3 }
)
assert.deepEqual(
  fallback({ a: 1, b: undefined }, { a: undefined, b: 3, c: 4 }),
  { a: 1, b: 3 }
)
```

### Tabular alignment

For more legible output.

```typescript
import { getMaxLength } from '@fadroma/core'
assert.equal(getMaxLength(['a', 'ab', 'abcd', 'abc', 'b']), 4)
```

```typescript
import assert from 'node:assert'
```

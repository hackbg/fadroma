# Fadroma Agent API

The `@fadroma/agent` package defines the core operational model
and type vocabulary of the Fadroma dApp framework.

All other NPM packages in the Fadroma ecosystem
build upon this one, and either:

* Provide platform-specific implementations of these abstractions
  (such as an Agent that is specifically for the Secret Network,
  or a Builder that executes builds specifically in a Docker container), or

* Build atop the abstract object model to deliver new features with
  the appropriate degree of cross-platform support.

The `@fadroma/agent` package itself is written in a platform-independent way
(basic [isomorphic JavaScript](https://en.wikipedia.org/wiki/Isomorphic_JavaScript)).
and should contain no Node-specifics or other engine-specific features.

## In this package

### Chain API

The **Chain API** is a simple imperative transaction-level API for
interacting with Cosmos-like networks.

Its core primitives are the **`Chain`** and **`Agent`** abstract classes.
An `Agent` corresponds to your identity (wallet) on a given chain,
and lets you operate in terms of transactions (sending tokens, calling contracts, etc.)

* [**`@fadroma/scrt`**](./Scrt.spec.ts.md) provides
  **`ScrtChain`** and **`ScrtAgent`**, the concrete implementations
  of Fadroma Chain API for Secret Network.

### Deploy API

The **Ops API** revolves around the `Deployment` class, and associated
implementations of `Client`, `Builder`, `Uploader`, and `DeployStore`.

These classes are used for describing systems consisting of multiple smart contracts,
such as when deploying them from source. By defining such a system as one or more
subclasses of `Deployment`, Fadroma enables declarative, idempotent, and reproducible
smart contract deployments.

* **Explore the [deployment guide](./spec/DeployingContracts.ts.md)**
* One commonly used type of contract is a **custom token**. Fadroma Ops provides
  a deployment API for [managing native and custom tokens](./spec/Tokens.ts.md).
* The procedures for compiling contracts from source and uploading them to the chain,
  and for caching the results of those operations so you don't have to do them repeatedly,
  are implemented in the [`Builder` and `Uploader` classes](./spec/BuildingAndUploading.ts.md).

Concrete implementations of those are provided in `@fadroma/ops`.

### Mocknet

This is a lightweight mock of a CosmWasm-capable platform,
structured as an implementation of the Fadroma Chain API.
Mocknet executes smart contracts in a simulated environment
based on JavaScript's native WebAssembly runtime.

See [**Mocknet**](./mocknet.html).

## Chain: connecting

The `Chain` object identifies what chain to connect to -
such as the Secret Network mainnet or testnet.

Since the workflow is request-based, no persistent connection is maintained.

```typescript
import { Chain } from '@fadroma/agent'
let chain: Chain
```

### Chain modes

Chains can be in several `mode`s, enumerated by `ChainMode` a.k.a. `Chain.Mode`.

The `Chain#devMode` flag is true if you are able to restart
the chain and start over (i.e. when using a devnet or mocknet).

* **Mainnet** is the production chain where value is stored.

```typescript
chain = Chain.mainnet({ id: 'id', url: 'example.com' })

assert(!chain.devMode)
assert(chain.isMainnet)
```

* **Testnet** is a persistent remote chain used for testing.

```typescript
chain = Chain.testnet({ id: 'id', url: 'example.com' })

assert(!chain.devMode)
assert(chain.isTestnet)
assert(!chain.isMainnet)
```

* [**Devnet**](../devnet/Devnet.spec.ts.md) uses a real chain node, booted up temporarily in
  a local environment.

```typescript
chain = Chain.devnet({ id: 'id', url: 'example.com' })

assert(chain.devMode)
assert(chain.isDevnet)
assert(!chain.isMainnet)
```

* [**Mocknet**](../mocknet/Mocknet.spec.ts.md) is a fast, nodeless way of executing contract code
  in the local JS WASM runtime.

```typescript
chain = Chain.mocknet({ id: 'id' url: 'example.com' })

assert(chain.devMode)
assert(chain.isMocknet)
assert(!chain.isMainnet)
```

## Agent: authenticating

To transact on a [chain](./Chains.ts.md), you need to authenticate
with your identity (account, wallet). To do that, you obtain an
`Agent` from the `Chain` using `Chain#getAgent({ mnemonic })`.

If you don't pass a mnemonic, a random mnemonic and address will be generated.

```typescript
import { Agent } from '@fadroma/agent'
let agent: Agent = await chain.getAgent({ address: 'testing1agent0' })

assert.ok(agent instanceof Agent, 'Agent returned')
assert.equal(agent.chain, chain,  'Agent#chain assigned')
assert.equal(agent.address, 'testing1agent0',  'Agent#address assigned')
```

### Block height

Having obtained an `Agent`, you are ready to begin performing operations.
The simplest thing to do is waiting until the block height increments.
The block height is the heartbeat of the blockchain.

* On Secret Network, this can be necessary for uploading multiple contracts.

```typescript
const height = await agent.height // Get the current block height

//await agent.nextBlock             // Wait for the block height to increment
//assert.equal(await agent.height, height + 1)
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
import { Fee } from '@fadroma/agent'
```

### Uploading code

```typescript
import { nullWasm } from '../fixtures/Fixtures.ts.md'

// Uploading from a Buffer
await agent.upload(nullWasm)

// Uploading from a filename
//await agent.upload('example.wasm')

// Uploading an Uploadable object
//await agent.upload({ artifact: './example.wasm', codeHash: 'expectedCodeHash' })

// Uploading multiple pieces of code:
/*await agent.uploadMany([
  'example.wasm',
  readFileSync('example.wasm'),
  { artifact: './example.wasm', codeHash: 'expectedCodeHash' }
])*/
```

The code ID is a unique identifier for compiled code uploaded to a chain.

The code hash also uniquely identifies for the code that underpins a contract.
However, unlike the code ID, which is opaque, the code hash corresponds to the
actual content of the code. Uploading the same code multiple times will give
you different code IDs, but the same code hash.

```typescript
import {  assertCodeHash, codeHashOf } from '@fadroma/agent'

assert.ok(assertCodeHash({ codeHash: 'code-hash-stub' }))
assert.throws(()=>assertCodeHash({}))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

### Instantiating contracts

* Instantiating a single contract:

```typescript
await agent.instantiate({ codeId: '1', label: 'unique1', initMsg: { arg: 'val' } })
```

* Instantiating multiple contracts in a single transaction:

```typescript
await agent.instantiateMany([
  { codeId: '2', label: 'unique2', initMsg: { arg: 'values' } },
  { codeId: '3', label: 'unique3', initMsg: { arg: 'values' } }
})
```

### Querying contract state

```typescript
const response =
  await agent.query({ address: 'address', codeHash: 'codeHash' }, { method: { arg: 'val' } })
```

### Executing transactions

Executing a single transaction:

```typescript
const result =
  await agent.execute({ address: 'address', codeHash: 'codeHash' }, { method: { arg: 'val' } })
```

Broadcasting multiple execute calls as a single transaction message
(transaction bundling):

```typescript
const results = await agent.bundle(async bundle=>{
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { method: { arg: 'val' } })
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { method: { arg: 'val' } })
}).run()
```

## Bundle: batching transactions

To submit multiple messages as a single transaction, you can
use Bundles.
  * A `Bundle` is a special kind of `Agent` that
    does not broadcast messages immediately.
  * Instead, messages are collected inside the bundle until
    the caller explicitly submits them.
  * Bundles can also be saved for manual signing of multisig
    transactions

A `Bundle` is designed to serve as a stand-in for its corresponding
`Agent`, and therefore implements the same API methods.
  * However, some operations don't make sense in the middle of a Bundle.
  * Most importantly, querying any state from the chain
    must be done either before or after the bundle.
  * Trying to query state from a `Bundle` agent will fail.

```typescript
import { Chain, Agent, Bundle } from '@fadroma/agent'
chain = new Chain({ id: 'id', url: 'example.com', mode: 'mainnet' })
agent = await chain.getAgent()
let bundle: Bundle
```

```typescript
import { Client } from '@fadroma/agent'
bundle = new Bundle(agent)

assert(bundle.getClient(Client, '') instanceof Client, 'Bundle#getClient')
assert.equal(await bundle.execute({}), bundle)
assert.equal(bundle.id, 1)
//assert(await bundle.instantiateMany({}, []))
//assert(await bundle.instantiateMany({}, [['label', 'init']]))
//assert(await bundle.instantiate({}, 'label', 'init'))
assert.equal(await bundle.checkHash(), 'code-hash-stub')

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

## Client: talking to contracts

Represents an interface to an existing contract.
  * The default `Client` class allows passing messages to the contract instance.
  * **Implement a custom subclass of `Client` to define specific messages as methods**.
    This is the main thing to do when defining your Fadroma Client-based API.

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '@fadroma/agent'
let address = 'some-addr'
let codeHash = 'some-hash'
let client: Client = new Client({ agent, address, codeHash })

assert.equal(client.agent,    agent)
assert.equal(client.address,  address)
assert.equal(client.codeHash, codeHash)

client.fees = { 'method': 100 }

assert.equal(client.getFee('method'), 100)

assert.equal(client.getFee({'method':{'parameter':'value'}}), 100)

let agent2 = Symbol()
assert.equal(
  client.withAgent(agent2).agent,
  agent2
)

client.agent = { execute: async () => 'ok' }
assert.equal(
  await client.execute({'method':{'parameter':'value'}}),
  'ok'
)
```

Once you know what methods your contract will support,
you'll want to extend `Client` and implement them there:

```typescript
let deployment: Deployment
let template:   Template
let instance:   Instance

class MyClient extends Client {
  address = 'unspecified'
  myMethod () { return this.execute({ my_method: {} }) }
  myQuery () { return this.query({ my_query: {} }) }
}
```

```typescript

import { Builder } from '@fadroma/agent'

deployment = new Deployment({
  agent: new Agent({ chain: new Chain({ id: 'test', mode: Chain.Mode.Devnet }) }),
  builder: new Builder()
})

assert.ok(deployment.devMode, 'deployment is in dev mode')
assert.equal(deployment.size, 0)

template = await deployment.template({
  codeId: 2,
  client: MyClient,
  crate: 'fadroma-example-kv'
})

assert.ok(template.info)

instance = template.instance({
  name: 'custom-client-contract',
  initMsg: {}
})

assert.equal(deployment.size, 1)
assert.ok(await template.compiled)
assert.ok(await template.uploaded)
//assert.ok(instance instanceof MyClient) // FIXME
//assert.ok(await instance.myMethod())
//assert.ok(await instance.myQuery())
```

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.

### Fetching metadata

```typescript
import {
  fetchCodeHash,
  fetchCodeId,
  fetchLabel
} from '@fadroma/agent'

instance.address = 'someaddress' // FIXME
assert.ok(instance.codeHash = await fetchCodeHash(instance, agent))
//assert.ok(instance.codeId   = await fetchCodeId(instance, agent))
assert.ok(instance.label    = await fetchLabel(instance, agent))

assert.equal(instance.codeHash, await fetchCodeHash(instance, agent, instance.codeHash))
//assert.equal(instance.codeId,   await fetchCodeId(instance, agent, instance.codeId))
assert.equal(instance.label,    await fetchLabel(instance, agent, instance.label))

assert.rejects(fetchCodeHash(instance, agent, 'unexpected'))
assert.rejects(fetchCodeId(instance, agent, 'unexpected'))
assert.rejects(fetchLabel(instance, agent, 'unexpected'))
```

### Per-contract fee defaults

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

## Deployment: defining contract relations

```typescript
import { Deployment } from '@fadroma/agent'

/*class MyDeployment extends Deployment {

  myContract1: PromiseLike<Contract<MyClient>> = this.contract({
    name: 'my-contract-1',
    client: MyClient,
    crate: 'test'
  })

  myContract2: PromiseLike<Contract<MyClient>> = this.contract({
    name: 'my-contract-2',
    client: MyClient
    crate: 'test'
  })

  myTemplate: PromiseLike<Template<Contract<MyClient>>> = this.template({
    client: MyClient
    crate: 'test'
  })

  myInstances1 = this.myTemplate.instances({
    myContract3: {}
    myContract4: {}
  })

  myInstances2 = this.myTemplate.instances([
    ['my-contract-5', {}],
    ['my-contract-6', {}],
  ])

  async deploy () {
    const [
      myContract1,
      myContract2,
      { myContract3, myContract4 },
      [ myContract5, myContract6 ]
    ] = await Promise.all([
      this.myContract1,
      this.myContract2,
      this.myInstances1,
      this.myInstances2
    ])
    return {
      myContract1,
      myContract2,
      myContract3,
      myContract4,
      myContract5,
      myContract6,
    }
  }

}

const myDeployment1 = new MyDeployment({ name: 'my-deployment-1' })
await myDeployment1.deploy()

const myDeployment2 = new MyDeployment({ name: 'my-deployment-2' })
await myDeployment2.deploy()*/
```

### Template: build and upload

### Contract: full contract lifecycle

```typescript
import { Contract } from '@fadroma/agent'

new Contract({
  repository: 'REPO',
  revision: 'REF',
  workspace: 'WORKSPACE'
  crate: 'CRATE'
})
```

### Contract label prefixes and suffixes

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

### Contract lifecycle

The `Metadata` class is the base class of the
`ContractSource`->`Template`->`Contract` inheritance chain.

Represents a contract that is instantiated from a `codeId`.
  * Can have an `address`.
  * You can get a `Client` from a `Contract` using
    the `getClient` family of methods.

```typescript
import { Contract, toInstanceReceipt } from '@fadroma/agent'
instance = new Contract()
assert.ok(toInstanceReceipt(instance))
//assert.ok(await instance.define({ agent }).found)
//assert.ok(await instance.define({ agent }).deployed)
```

### Storing deployment state

### Exporting deployments

### Connecting to an exported deployment

### Versioned deployments

## Builder

Implemented by `@fadroma/build`.

* **BuildRaw**: runs the build in the current environment
* **BuildContainer**: runs the build in a container for enhanced reproducibility

## Uploader

Implemented by `@fadroma/upload`.

* **FSUploader**: Support for uploading from Node FS.
* TODO: **FetchUploader**: Support for uploading from any URL incl. file:///

## Errors

The `Error` class, based on `@hackbg/oops`, defines
custom error subclasses for various error conditions.

```typescript
// Make sure each error subclass can be created with no arguments:
import { Error } from '@fadroma/agent'
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
  assert(new Error[subtype]() instanceof Error, `error ${subtype}`)
}
```

## Events

The `Console` class, based on `@hackbg/logs`, collects all logging output in one place.
In the future, this will enable semantic logging and/or GUI notifications.

```typescript
// Make sure each log message can be created with no arguments:
import { Console } from '@fadroma/agent'
const log = new Console()

log.object()
log.object({foo:'bar',baz(){},quux:[],xyzzy:undefined,fubar:{}})

log.deployment()
log.deployment({ state: { foo: {}, bar: {} } })
log.receipt()
log.foundDeployedContract()
log.beforeDeploy()
log.afterDeploy()
log.deployFailed()
log.deployManyFailed()
log.deployFailedContract()
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
import { into, intoArray, intoRecord } from '@fadroma/agent'

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
import { validated } from '@fadroma/agent'
assert.ok(validated('test', 1))
assert.ok(validated('test', 1, 1))
assert.ok(validated('test', 'a', 'A'))
assert.throws(()=>validated('test', 1, 2))
assert.throws(()=>validated('test', 'a', 'b'))
```

### Overrides and fallbacks

Only work on existing properties.

```typescript
import { override, fallback } from '@fadroma/agent'
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
assert.equal(getMaxLength(['a', 'ab', 'abcd', 'abc', 'b']), 4)
function getMaxLength (strings: string[]): number {
  return Math.max(...strings.map(string=>string.length))
}
```

```typescript
import assert from 'node:assert'
```

# Fadroma Guide: Agent API

The **Agent API** is a simple imperative transaction-level API for
interacting with Cosmos-like networks.

Its core primitives are the **`Chain`** and **`Agent`** abstract classes.
An `Agent` corresponds to your identity (wallet) on a given chain,
and lets you operate in terms of transactions (sending tokens, calling contracts, etc.)

* [**`@fadroma/scrt`**](./Scrt.spec.ts.md) provides
  **`ScrtChain`** and **`ScrtAgent`**, the concrete implementations
  of Fadroma Chain API for Secret Network.

## Chain

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

## Agent

To transact on a [chain](./Chains.ts.md), you need to authenticate
with your identity (account, wallet). To do that, you obtain an
`Agent` from the `Chain` using `chain.getAgent({...})`.

If you don't pass a mnemonic, a random mnemonic and address will be generated.

```typescript
import { Agent } from '@fadroma/agent'
let agent: Agent = await chain.getAgent({ address: 'testing1agent0' })

assert.ok(agent instanceof Agent, 'an Agent was returned')
assert.equal(agent.chain, chain,  'agent.chain assigned')
assert.equal(agent.address, 'testing1agent0',  'agent.address assigned')
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

### Default gas fees

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

### Batching transactions

To submit multiple messages as a single transaction, you can
use the `Bundle` class through `Agent#bundle`.

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

## Client

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

### Metadata

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(aClient.meta instanceof Contract)
assert.equal(aClient.meta.deployedBy, agent.address)
```

Fetching metadata:

```typescript
import { fetchCodeHash, fetchCodeId, fetchLabel } from '@fadroma/agent'

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

### Client agent

By default, the `Client`'s `agent` property is equal to the `agent`
which deployed the contract. This property determines the address from
which subsequent transactions with that `Client` will be sent.

In case you want to deploy the contract as one identity, then interact
with it from another one as part of the same procedure, you can set `agent`
to another instance of `Agent`:

```typescript
assert.equal(aClient.agent, agent)
aClient.agent = await chain.getAgent()
```

Similarly to `withFee`, the `as` method returns a new instance of your
client class, bound to a different `agent`, thus allowing you to execute
transactions as a different identity.

```typescript
const agent1 = await chain.getAgent(/*...*/)
const agent2 = await chain.getAgent(/*...*/)
const client = agent1.getClient(MyContract, "...")
client.tx1() // signed by agent1
client.asAgent(agent2).tx1() // signed by agent2
```

### Per-transaction fees

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

The result of deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

When executing a transaction, a gas limit is specified so that invoking a transaction cannot
consume too much gas. However, each smart contract transaction method performs different
computations, and therefore needs a different amount of gas.

You can specify default gas limits for each method by defining the `fees: Record<string, IFee>`
property of your client class:

```typescript
import { Client, Fee } from '@fadroma/agent'
export class MyContract extends Client {
  fees = {
    tx1: new Fee('10000', 'uscrt'),
    tx2: new Fee('20000', 'uscrt'),
    tx3: new Fee('30000', 'uscrt'),
    tx4: new Fee('40000', 'uscrt'),
  }
  async tx1 ()  { return await this.execute("tx1") }
  async tx2 (n) { return await this.execute({tx2: n}) }
  async tx3 ()  { return await this.execute({tx3: {}}) }
  async tx4 (n) { return await this.execute({tx4: {my_value: n}}) }
}
```

You can also specify one fee for all transactions. This will replace the
default `exec` fee configured in the agent.

You can override these defaults by using the `withFee(fee: IFee)` method:

```typescript
const result = await client.withFee(new Fee('100000', 'uscrt')).tx1()
```

This method works by returning a new instance of `MyContract` that has
the fee overridden.

### Defining query and transaction methods

The main things that you need to know for implementing a client class
are the `query` and `execute` methods:

* You pass them the message as a JS object.
* They serialize it to JSON and pass it to the contract.
* Then, they return a `Promise` of the value returned by the contract.
* If the returned value is an error, the promise will reject (i.e. if you're
  `await`ing the promise chain, an `Error` will be thrown).

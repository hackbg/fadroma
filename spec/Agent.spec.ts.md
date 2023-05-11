# Fadroma Agent API

The **Agent API** is a simple imperative transaction-level API for
interacting with Cosmos-like networks.

Its core primitives are the **`Chain`** and **`Agent`** abstract classes.
An `Agent` corresponds to your identity (wallet) on a given chain,
and lets you operate in terms of transactions (sending tokens, calling contracts, etc.)

**Note:** The `Chain` and `Agent` exported from `@fadroma/agent` are stub implementations.
[The **`@fadroma/scrt`** package](./scrt.html) provides
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

**Note:** `Chain` in `@fadroma/agent` is a stub class. If you want to connect
to Secret Network, you need the `ScrtChain` implementation from `@fadroma/scrt`,
which is available using either:

```typescript
import { Scrt } from '@hackbg/fadroma'
chain = Scrt.Chain.mainnet()
```

or

```typescript
import * as Scrt from '@fadroma/scrt'
chain = Scrt.Chain.mainnet()
```

### Chain modes

Chains can be in several `mode`s, enumerated by `ChainMode` a.k.a. `Chain.Mode`.
To connect to a chain in a specific mode, you can use the corresponding static
method on the `Chain`

**Mainnet** is the production chain where value is stored.

```typescript
chain = Chain.mainnet({ id: 'id', url: 'example.com' })

assert(!chain.devMode)
assert(chain.isMainnet)
```

**Testnet** is a persistent remote chain used for testing.

```typescript
chain = Chain.testnet({ id: 'id', url: 'example.com' })

assert(!chain.devMode)
assert(chain.isTestnet)
assert(!chain.isMainnet)
```

[**Devnet**](../devnet/Devnet.spec.ts.md) uses a real chain node, booted up temporarily in
a local environment.

```typescript
chain = Chain.devnet({ id: 'id', url: 'example.com' })

assert(chain.devMode)
assert(chain.isDevnet)
assert(!chain.isMainnet)
```

[**Mocknet**](../mocknet/Mocknet.spec.ts.md) is a fast, nodeless way of executing contract code
in the local JS WASM runtime.

```typescript
chain = Chain.mocknet({ id: 'id' url: 'example.com' })

assert(chain.devMode)
assert(chain.isMocknet)
assert(!chain.isMainnet)
```

### Dev mode

The `chain.devMode` flag is true if you are able to restart
the chain and start over (i.e. when using a devnet or mocknet).

## Agent

To transact on a [chain](./Chains.ts.md), you need to authenticate
with your identity (account, wallet). To do that, you obtain an
`Agent` from the `Chain` using `chain.getAgent({...})`.

Instantiating multiple authenticated agents allows the same program
to interact with the chain from multiple distinct identities.

If you don't pass a mnemonic, a random mnemonic and address will be generated.

```typescript
import { Agent } from '@fadroma/agent'
let agent: Agent = await chain.getAgent({ name: 'testing1' })

assert.ok(agent instanceof Agent,    'an Agent was returned')
assert.ok(agent.address,             'agent has address')
assert.equal(agent.name, 'testing1', 'agent.name assigned')
assert.equal(agent.chain, chain,     'agent.chain assigned')
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

### Gas fees

Transacting creates load on the network, which incurs costs on node operators.
Compensations for transactions are represented by the gas metric.

```typescript
import { Fee } from '@fadroma/agent'
```

### Native token transactions

You're not on the chain to wait around, though.
The simplest operation you can conduct is transact with native tokens.

#### Query balance

```typescript
await agent.balance             // In the default native token
await agent.getBalance()        // In the default native token
await agent.getBalance('token') // In a non-default native token
```

#### Send default token

```typescript
await agent.send('recipient-address', 1000)
await agent.send('recipient-address', '1000')
```

#### Send non-default tokens

```typescript
await agent.send('recipient-address', [
  {denom:'token1', amount: '1000'}
  {denom:'token2', amount: '2000'}
])
```

### Compute transactions

#### Uploading code

```typescript
import { examples } from '../fixtures/Fixtures.ts.md'
import { readFileSync } from 'node:fs'

// uploading from a Buffer
await agent.upload(readFileSync(examples['KV'].path), {
  // optional metadata
  artifact: examples['KV'].path
})

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
import { assertCodeHash, codeHashOf } from '@fadroma/agent'

assert.ok(assertCodeHash({ codeHash: 'code-hash-stub' }))
assert.throws(()=>assertCodeHash({}))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

#### Instantiating contracts

* Instantiating a single contract:

```typescript
const c1 = await agent.instantiate({
  codeId:   '1',
  codeHash: 'verify!',
  label:    'unique1',
  initMsg:  { arg: 'val' }
})
```

* Instantiating multiple contracts in a single transaction:

```typescript
const [ c2, c3 ] = await agent.instantiateMany([
  { codeId: '2', label: 'unique2', initMsg: { arg: 'values' } },
  { codeId: '3', label: 'unique3', initMsg: { arg: 'values' } }
])
```

#### Querying contract state

```typescript
const response = await agent.query(c1, { get: { key: '1' } })
assert.rejects(agent.query(c1, { invalid: "query" }))
```

#### Executing transactions

Executing a single transaction:

```typescript
const result = await agent.execute(c1, { set: { key: '1', value: '2' } })
assert.rejects(agent.execute(c1, { invalid: "tx" }))
```

Broadcasting multiple execute calls as a single transaction message
(transaction bundling):

```typescript
const results = await agent.bundle(async bundle=>{
  await bundle.execute(c1, { del: { key: '1' } })
  await bundle.execute(c2, { set: { key: '3', value: '4' } })
}).run()
```

#### Batching transactions

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

Client objects are interfaces to programs deployed in a specific environment, i.e.
**they represent smart contracts**. Once you know what methods your contract will support,
you'll want to extend `Client` and implement handles to them there:

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.

```typescript
import { Client } from '@fadroma/agent'
class MyClient extends Client {
  myMethod = (param) =>
    this.execute({ my_method: { param } })
  myQuery = (param) =>
    this.query({ my_query: { param } }) }
}
```

### Constructing

To operate a smart contract through a `Client`,
you need an `agent`, an `address`, and a `codeHash`:

```typescript
let address  = Symbol('some-addr')
let codeHash = Symbol('some-hash')
let client: Client = new MyClient({ agent, address, codeHash })

assert.equal(client.agent,    agent)
assert.equal(client.address,  address)
assert.equal(client.codeHash, codeHash)
```

Alternatively you can construct through `agent.getClient`:

```typescript
client = agent.getClient(MyClient, address, codeHash)
```

### Querying and transacting

```typescript
await client.execute({ my_method: {} })
await client.query({ my_query: {} })
```

### Per-transaction fees

You can specify default gas limits for each method by defining the `fees: Record<string, IFee>`
property of your client class:

```typescript
const fee1 = new Fee('100000', 'uscrt')
client.fees['my_method'] = fee1

assert.deepEqual(client.getFee('my_method'), fee1)
assert.deepEqual(client.getFee({'my_method':{'parameter':'value'}}), fee1)
```

You can also specify one fee for all transactions, using `client.withFee({ gas, amount: [...] })`.
This method works by returning a copy of `client` with fees overridden by the provided value.

```typescript
const fee2 = new Fee('200000', 'uscrt')

assert.deepEqual(await client.withFee(fee2).getFee('my_method'), fee2)
```

### Metadata

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
import { Contract } from '@hackbg/fadroma'
assert.ok(client.meta instanceof Contract)
```

Fetching metadata:

```typescript
import { fetchCodeHash, fetchCodeId, fetchLabel } from '@fadroma/agent'

client.address = 'someaddress' // FIXME
assert.ok(client.codeHash = await fetchCodeHash(client, agent))
//assert.ok(client.codeId   = await fetchCodeId(client, agent))
assert.ok(client.label    = await fetchLabel(client, agent))

assert.equal(client.codeHash, await fetchCodeHash(client, agent, client.codeHash))
//assert.equal(client.codeId,   await fetchCodeId(client, agent, client.codeId))
assert.equal(client.label,    await fetchLabel(client, agent, client.label))

assert.rejects(fetchCodeHash(client, agent, 'unexpected'))
assert.rejects(fetchCodeId(client, agent, 'unexpected'))
assert.rejects(fetchLabel(client, agent, 'unexpected'))
```

### Client agent

By default, the `Client`'s `agent` property is equal to the `agent`
which deployed the contract. This property determines the address from
which subsequent transactions with that `Client` will be sent.

In case you want to deploy the contract as one identity, then interact
with it from another one as part of the same procedure, you can set `agent`
to another instance of `Agent`:

```typescript
assert.equal(client.agent, agent)
client.agent = await chain.getAgent()
assert.notEqual(client.agent, agent)
```

Similarly to `withFee`, the `as` method returns a new instance of your
client class, bound to a different `agent`, thus allowing you to execute
transactions as a different identity.

```typescript
const agent1 = await chain.getAgent(/*...*/)
const agent2 = await chain.getAgent(/*...*/)

client = agent1.getClient(Client, "...")

// executed by agent1:
client.execute({ my_method: {} })

// executed by agent2
client.withAgent(agent2).execute({ my_method: {} })
```

---

```typescript
import assert from 'node:assert'
import './Agent.test.ts'
```

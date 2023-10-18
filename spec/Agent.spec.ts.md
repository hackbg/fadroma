# Fadroma Agent: Scriptable User Agents for the Blockchain

The **Fadroma Agent API** is Fadroma's imperative API for interacting with smart contract
platforms. It's specified by the [**@fadroma/agent**](https://www.npmjs.com/package/@fadroma/agent)
package, and is in effect a reduced and simplified vocabulary that covers the common ground
between different implementations of smart contract-enabled chains. The Agent API is designed
to expressing smart contract operations in a concise and readable manner.

Since different chains provide different connection methods and client libraries,
the packages under [**@fadroma/connect**](https://www.npmjs.com/package/@fadroma/connect)
contain the concrete implementations of Fadroma Agent for the given platforms:

* [**@fadroma/scrt**](https://www.npmjs.com/package/@fadroma/scrt) for Secret Network,
* [**@fadroma/cw**](https://www.npmjs.com/package/@fadroma/cw) for other CosmWasm-enabled chains

## Connecting to a chain

An instance of the **Chain** class corresponds to a connection to a given blockchain.

A chain exists in one of several modes, represented by the **chain.mode** property
and the **ChainMode** enum:

* ****mainnet**** is a production chain storing real value;
* ****testnet**** is a persistent remote chain used for testing;
* ****devnet**** is a locally run chain node in a Docker container;
* ****mocknet**** is a mock implementation of a chain.

The **Chain.mainnet**, **Chain.testnet**, **Chain.devnet** and **Chain.mocknet**
static methods construct a chain in the given mode.

You can also check whether a chain is in a given mode using the
**chain.isMainnet**, **chain.isTestnet**, **chain.isDevnet** and **chain.isMocknet**
read-only boolean properties.

The **chain.devMode** property is true when the chain is a devnet or mocknet.
Devnets and mocknets are under your control - i.e. you can delete them and
start over. On the other hand, mainnet and testnet are global and persistent.

The **chain.id** property is a string that uniquely identifies a given blockchain.
Examples are `secret-4` (Secret Network mainnet), `pulsar-3` (Secret Network testnet),
or `okp4-nemeton-1` (OKP4 testnet). Chains in different modes usually have distinct IDs.

The same chain may be accessible via different URLs. The **chain.url** property
identifies the URL to which requests are sent.

The **chain.ready** property... TODO

Examples:

```typescript
// TODO
```

### Block height

The **chain.height** getter returns a **Promise** wrapping the current block height.

The **chain.nextBlock** getter returns a **Promise** which resolves when the
block height increments, and contains the new block height.

Examples:

```typescript
// Get the current block height
const height = await chain.height

// Wait until the block height increments
await chain.nextBlock
```

### Native tokens

The **Chain.defaultDenom** and **chain.defaultDenom** properties... TODO

The **chain.getBalance(denom, address)** async method queries the balance of a given
address in a given token.

Examples:

```typescript
// TODO
```

### Querying contracts

The **chain.query(contract, msg)** method... TODO

The **chain.getCodeId(address)**, **chain.getHash(addressOrCodeId)** and **chain.getLabel(address)**
async methods query the corresponding metadata of a smart contract.

The **chain.checkHash(address, codeHash)** method warns if the code hash of a contract
is not the expected one.

Examples:

```typescript
// TODO
```

## Authenticating an agent

To transact on a given chain, you need to authorize an **Agent**.
This is done using the **chain.getAgent(...)** method, which synchonously
returns a new **Agent** instance for the given chain.

This method may be called with one of the following signatures:

* **chain.getAgent(options)**
* **chain.getAgent(CustomAgentClass, options)**
* **chain.getAgent(CustomAgentClass)**

The returned **Agent** starts out uninitialized. Awaiting the **agent.ready** property makes sure
the agent is initialized. Usually, agents are initialized the first time you call one of the
async methods described below.

If you don't pass a mnemonic, a random mnemonic and address will be generated.

Examples:

```typescript
// TODO
```

### Agent identity

The **agent.name** property... TODO

The **agent.address** property... TODO

Instantiating multiple agents allows the same program to interact with the chain
from multiple distinct identities.

Examples:

```typescript
// TODO
```

### Agents and block height

TODO

On Secret Network, this can be necessary for uploading multiple contracts... TODO

Examples:

```typescript
// TODO
```

### Native token transactions

The **agent.getBalance(...)** async method works the same as **chain.getBalance**... TODO

The **agent.balance** readonly property is a shorthand for querying the current agent's balance
in the chain's main native token.

The **agent.send(...)** async method... TODO

The **agent.sendMany(...)** async method... TODO

Examples:

```typescript
await agent.balance // In the default native token

await agent.getBalance() // In the default native token

await agent.getBalance('token') // In a non-default native token

await agent.send('recipient-address', 1000)

await agent.send('recipient-address', '1000')

await agent.send('recipient-address', [
  {denom:'token1', amount: '1000'}
  {denom:'token2', amount: '2000'}
])
```

### Uploading and instantiating contracts

The **agent.upload(...)** async method... TODO

The **agent.uploadMany(...)** async method... TODO

The **agent.instantiate(...)** async method... TODO

The **agent.instantiateMany(...)** async method... TODO

The **agent.batch(...)** method...

Examples:

```typescript
import { examples } from './fixtures/Fixtures.ts.md'
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

const c1 = await agent.instantiate({
  codeId:   '1',
  codeHash: 'verify!',
  label:    'unique1',
  initMsg:  { arg: 'val' }
})

const [ c2, c3 ] = await agent.instantiateMany([
  { codeId: '2', label: 'unique2', initMsg: { arg: 'values' } },
  { codeId: '3', label: 'unique3', initMsg: { arg: 'values' } }
])

const result = await agent.execute(c1, { set: { key: '1', value: '2' } })
assert.rejects(agent.execute(c1, { invalid: "tx" }))

const results = await agent.batch(async batch=>{
  await batch.execute(c1, { del: { key: '1' } })
  await batch.execute(c2, { set: { key: '3', value: '4' } })
}).run()
```

### Executing transactions and performing queries

The **agent.query(...)** async method... TODO

The **agent.execute(...)** async method... TODO

Examples:

```typescript
const response = await agent.query(c1, { get: { key: '1' } })
assert.rejects(agent.query(c1, { invalid: "query" }))
```

### Batching transactions

The **agent.batch(...)** method creates an instance of **Batch**.

Conceptually, you can view a batch as a kind of agent that does
not execute transactions immediately - it collects them, and waits
for the **batch.broadcast()** method.

The other difference between a batch and and agent is that you
cannot query from a batch. This is to avoid confusion and invalid
state. If you need to perform queries, use a regular agent before or after
the batch.

Batches can also be saved for manual signing of multisig
transactions.

To create and submit a batch in a single expression,
you can use `batch.wrap(async (batch) => { ... })`:

Examples:

```typescript
// TODO
```

## Contract clients

The **Client** class represents a handle to a smart contract deployed to a given chain.

To provide a robust SDK to users of your project, simply publish a NPM package
containing subclasses of **Client** that correspond to your contracts and invoke
their methods.

To operate a smart contract through a `Client`,
you need an `agent`, an `address`, and a `codeHash`:

Example:

```typescript
import { Client } from '@fadroma/agent'

class MyClient extends Client {

  myMethod = (param) => this.execute({ my_method: { param } })

  myQuery = (param) => this.query({ my_query: { param } }) }

}

let address  = Symbol('some-addr')
let codeHash = Symbol('some-hash')
let client: Client = new MyClient({ agent, address, codeHash })

assert.equal(client.agent,    agent)
assert.equal(client.address,  address)
assert.equal(client.codeHash, codeHash)
client = agent.getClient(MyClient, address, codeHash)
await client.execute({ my_method: {} })
await client.query({ my_query: {} })
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

### Client metadata

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

import { assertCodeHash, codeHashOf } from '@fadroma/agent'

assert.ok(assertCodeHash({ codeHash: 'code-hash-stub' }))
assert.throws(()=>assertCodeHash({}))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

The code ID is a unique identifier for compiled code uploaded to a chain.

The code hash also uniquely identifies for the code that underpins a contract.
However, unlike the code ID, which is opaque, the code hash corresponds to the
actual content of the code. Uploading the same code multiple times will give
you different code IDs, but the same code hash.

## Gas fees

Transacting creates load on the network, which incurs costs on node operators.
Compensations for transactions are represented by the gas metric.

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

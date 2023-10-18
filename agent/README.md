# [Fadroma](https://fadroma.tech) Agent: Scriptable User Agents for the Blockchain

[![](https://img.shields.io/npm/v/@fadroma/agent?color=%2365b34c&label=%40fadroma%2Fagent&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/agent)

The *Fadroma Agent API* is Fadroma's imperative API for interacting with smart contract
platforms. It's designed for expressing smart contract operations in a concise and readable manner.

The API is specified by the [**@fadroma/agent**](https://www.npmjs.com/package/@fadroma/agent)
package. In effect, it's a reduced and simplified vocabulary that covers the common ground
between different implementations of smart contract-enabled chains. 

Since different chains provide different client libraries and connection methods,
the concrete implementations of the Fadroma Agent API are contained in separate
packages:

* [**@fadroma/scrt**](https://www.npmjs.com/package/@fadroma/scrt) for Secret Network;
* [**@fadroma/cw**](https://www.npmjs.com/package/@fadroma/cw) for other CosmWasm-enabled chains,
  such as OKP4.

[**@fadroma/connect**](https://www.npmjs.com/package/@fadroma/connect) reexports all available
Fadroma Agent API implementations. It's recommended to use **@fadroma/connect** when depending
on more than one of the above.

The overarching goal of Fadroma Agent is to enable developers to learn only a single client
library for all supported blockchains and client platforms.

## Connecting to a chain

Instances of the **Chain** class represents blockchains.

A chain may exists in one of several modes,
represented by the **chain.mode** property
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

Since the underlying API classes (e.g. `CosmWasmClient` or `SecretNetworkClient`) are
initialized asynchronously, and JavaScript does not have async constructors, chains start
out in an unitialized state, where the **chain.api** property is not populated. Awaiting the
**chain.ready** one-shot promise returns the same chain object, but with the API client populated.
Normally, this is done automatically when calling the chain's async methods; but if you want to
access the API handle directly, you would need to **await chain.ready**. This is useful if you
want to access a chain-specific feature that is not part of the Fadroma Agent API

Examples:

```typescript
const { api } = await chain.ready
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

The **Chain.defaultDenom** and **chain.defaultDenom** properties contain the default
denomination of the chain's native token.

The **chain.getBalance(denom, address)** async method queries the balance of a given
address in a given token.

Examples:

```typescript
// TODO
```

### Querying contracts

The **chain.query(contract, message)** async method calls a read-only query method of a smart
contract.

The **chain.getCodeId(address)**, **chain.getHash(addressOrCodeId)** and
**chain.getLabel(address)** async methods query the corresponding metadata of a smart contract.

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

Instantiating multiple agents allows the same program to interact with the chain
from multiple distinct identities.

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

The **agent.address** property is the on-chain address that uniquely identifies the agent.

The **agent.name** property is a user-friendly name for an agent. On devnet, the name is
also used to access the initial accounts that are created during devnet genesis.

### Agents and block height

The **agent.height** and **agent.nextBlock** methods are equivalent to the same methods
on the chain object, and are replicated on the Agent class purely for convenience.

```typescript
const height = await agent.height

await agent.nextBlock
```

### Native token transactions

The **agent.getBalance(denom, address)** async method works the same as **chain.getBalance(...)**
but defaults to the agent's address.

The **agent.balance** readonly property is a shorthand for querying the current agent's balance
in the chain's main native token.

The **agent.send(address, amounts, options)** async method sends one or more amounts of
native tokens to the specified address.

The **agent.sendMany([[address, coin], [address, coin]...])** async method sends native tokens
to multiple addresses.

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

The **agent.upload(...)** uploads a contract binary to the chain.

The **agent.instantiate(...)** async method takes a code ID and returns a contract
instance.

The **agent.instantiateMany(...)** async method instantiates multiple contracts within
the same transaction.

On Secret Network, it's not possible to send multiple separate upload transactions
within the same block. Therefore, when uploading multiple contracts, **agent.nextBlock**
needs to be awaited between them. **agent.uploadMany(...)** does this automatically.

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
await agent.upload('example.wasm') // TODO

// Uploading an Uploadable object
await agent.upload({ artifact: './example.wasm', codeHash: 'expectedCodeHash' }) // TODO

// Uploading multiple pieces of code:
await agent.uploadMany([
  'example.wasm',
  readFileSync('example.wasm'),
  { artifact: './example.wasm', codeHash: 'expectedCodeHash' }
])

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
```

### Executing transactions and performing queries

The **agent.query(contract, message)** async method calls a query method of a smart contract.
This is equivalent to **chain.query(...)**.

The **agent.execute(contract, message)** async method calls a transaction method of a smart
contract, signing the transaction as the given agent.

Examples:

```typescript
const response = await agent.query(c1, { get: { key: '1' } })
assert.rejects(agent.query(c1, { invalid: "query" }))

const result = await agent.execute(c1, { set: { key: '1', value: '2' } })
assert.rejects(agent.execute(c1, { invalid: "tx" }))
```

### Batching transactions

The **agent.batch(...)** method creates an instance of **Batch**.

Conceptually, you can view a batch as a kind of agent that does not execute transactions
immediately - it collects them, and waits for the **batch.broadcast()** method. You can
pass a batch anywhere you can pass an agent.

The main difference between a batch and and agent is that *you cannot query from a batch*.
This is because a batch is an atomic action, and queries made inbetween individual transactions
of a batch would return the state as it was before *all* the transactions. Therefore, to avoid
confusion and outdated state, the query methods of the batch "agent" throw errors.
If you need to perform queries, use a regular agent before or after the batch.

Instead of broadcasting, you can also export an unsigned batch, and pass it around manually
as part of a multisig transaction.

To create and submit a batch in a single expression,
you can use `batch.wrap(async (batch) => { ... })`:

Examples:

```typescript
const results = await agent.batch(async batch=>{
  await batch.execute(c1, { del: { key: '1' } })
  await batch.execute(c2, { set: { key: '3', value: '4' } })
}).run()
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

  myMethod = (param) => this.execute({
    my_method: { param }
  })

  myQuery = (param) => this.query({
    my_query: { param }
  })

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
import { fetchCodeHash, fetchCodeId, fetchLabel, assertCodeHash, codeHashOf } from '@fadroma/agent'

await fetchCodeHash(client, agent)
await fetchCodeId(client, agent)
await fetchLabel(client, agent)
codeHashOf({ codeHash: 'hash' })
codeHashOf({ code_hash: 'hash' })
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

## Declarative deployments

# Fadroma Deploy API

The **Deploy API** revolves around the `Deployment` class,
the `Template` and `Contract` classes, and the associated
implementations of `Client`, `Builder`, `Uploader`, and `DeployStore`.

```typescript
import { Deployment, Template, Contract, Client } from '@fadroma/agent'
let deployment: Deployment
let template:   Template
let contract:   Contract
```

These classes are used for describing systems consisting of multiple smart contracts,
such as when deploying them from source. By defining such a system as one or more
subclasses of `Deployment`, Fadroma enables declarative, idempotent, and reproducible
smart contract deployments.

## Deployment

The `Deployment` class represents a set of interrelated contracts.
To define your deployment, extend the `Deployment` class, and use the
`this.template({...})` and `this.contract({...})` methods to specify
what contracts to deploy:

```typescript
// in your project's api.ts:

import { Deployment } from '@fadroma/agent'

export class DeploymentA extends Deployment {

  kv1 = this.contract({
    name: 'kv1',
    crate: 'examples/kv',
    initMsg: {}
  })

  kv2 = this.contract({
    name: 'kv2',
    crate: 'examples/kv',
    initMsg: {}
  })

}
```

### Preparing

To prepare a deployment for deploying, use `getDeployment`.
This will provide a populated instance of your deployment class.

```typescript
import { getDeployment } from '@hackbg/fadroma'
deployment = getDeployment(DeploymentA, /* ...constructor args */)
```

### Deploying everything

Then, call its `deploy` method:

```typescript
await deployment.deploy()
```

For each contract defined in the deployment, this will do the following:

* If it's not compiled yet, this will **build** it.
* If it's not uploaded yet, it will **upload** it.
* If it's not instantiated yet, it will **instantiate** it.

### Expecting contracts to be deployed

Having deployed a contract, you want to obtain a `Client` instance
that points to it, so you can call the contract's methods.

Using the `contract.expect()` method you can get an instance
of the `Client` specified in the contract options, provided
the contract is already deployed (i.e. its address is known).

```typescript
assert(deployment.kv1.expect() instanceof Client)
assert(deployment.kv2.expect() instanceof Client)
```

This is the recommended method for passing handles to contracts
to your UI code after deploying or connecting to a stored deployment
(see below).

If the address of the request contract is not available,
this will throw an error.

### Deploying individual contracts with dependencies

By `await`ing a `Contract`'s `deployed` property, you say:
"give me a handle to this contract; if it's not deployed,
deploy it, and all of its dependencies (as specified by the `initMsg` method)".

```typescript
assert(await deployment.kv1.deployed instanceof Client)
assert(await deployment.kv2.deployed instanceof Client)
```

Since this does not call the deployment's `deploy` method,
it *only* deploys the requested contract and its dependencies
but not any other contracts defined in the deployment.

### Deploying with custom logic

The `deployment.deploy` method simply instantiates
all contracts in order. You are free to override it
and deploy the defined contracts according to some
custom logic:

```typescript
class DeploymentB extends Deployment {
  kv1 = this.contract({ crate: 'examples/kv', name: 'kv1', initMsg: {} })
  kv2 = this.contract({ crate: 'examples/kv', name: 'kv2', initMsg: {} })

  deploy = async (deployBoth: boolean = false) => {
    await this.kv1.deployed
    if (deployBoth) await this.kv2.deployed
    return this
  }
}
```

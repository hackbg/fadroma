# Fadroma: Contract deployment guide

```typescript
import assert from 'node:assert'
```

## The shape of the world

>“Tell me, as you promised!” implored the Master of space-time,
>hot tears thundering to the earth like mighty comets, “What is the shape of the universe?”
>“It is somewhat wheel-shaped,” said Aesma, which was a completely wrong answer.
>*-Abbadon*

Cosmos contracts can be seen as essentially equivalent to **persistent objects**:
they encapsulate some data alongside the methods used to operate on that data.
In this model, instantiating a contract is equivalent to constructing an object,
which then continues to exist forever on an append-only ledger of transactions.

The details are slightly more involved, since you need to compile the code and
upload it to the network before you can instantiate and operate it. That's why,
in order to deploy a contract, you must first describe it.

Fadroma provides the `Contract` object for that purpose:

```typescript
import { Contract } from '@fadroma/core'
const nullContract = new Contract()
```

This gives you an instance of the `Contract` class, representing a specific contract.
This `Contract` instance is also callable as a function; calling the function is equivalent
to instantiating the contract (and, if necessary, building and uploading it beforehand).

```typescript
assert(nullContract instanceof Contract)
assert(typeof nullContract === 'function')
```

Calling a `Contract` instance returns a `Task`; this is a promise-like object which represents
the action of deploying the contract. Like a regular `Promise`, a `Task` evaluates once, and
completes asynchronously; unlike a `Promise` (which executes as soon as it is created), a `Task`
only starts evaluating when the caller attempts to resolve it:

```typescript
const deployingNullContract = nullContract()
assert(deployingNullContract.then instanceof Function)
```

Of course, the `Task` that we just created by calling the `Contract` instance will fail,
because we haven't actually specified which contract to deploy; or where to deploy it;
or who is it that will deploy it. Let's do that now.

```typescript
assert.rejects(async () => await deployingNullContract)
```

## Some preparation

To simplify this test, we'll stub out the external world. Let's create test-only instances of
`Chain` and `Agent`:

```typescript
import { Chain } from '@fadroma/core'
let index = 0
const chain = new Chain('test')
const agent = Object.assign(await chain.getAgent(), {
  async instantiate () { return { address: `(address #${++index})` } },
  async execute     () { return {} },
  async query       () { return {} }
})
```

## Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md)
(that is, a contract that is already built and uploaded):

```typescript
const aContract = new Contract({
  name:    'contract1',
  initMsg: { parameter: 'value' },
  codeId:  1,
  agent
})
```

To deploy the contract uploaded as code ID 1, just call `aContract`, passing two things:
* an **instance ID**. This is the "friendly name" of the contract instance,
  and is used to construct its full unique label.
* an **init message**. This contains the "constructor parameters" that will be passed to the
  contract's init method.

```typescript
const aClient = await aContract()
```

The call will resolve resolve to a `Client` instance. You can use this to talk to the deployed
contract by invoking its query and transaction methods.

```typescript
import { Client } from '@fadroma/core'
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(address #1)')
assert.equal(typeof aClient.query,   'function')
assert.equal(typeof aClient.execute, 'function')
```

Congratulations, you've deployed a globally persistent object!

## Interacting with contracts using the `Client`

The result of deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

### `client.meta`

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(aClient.meta instanceof Contract)
assert.equal(aClient.meta.deployedBy, agent.address)
```

### `client.agent`

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

## Retrieving existing contracts from the `Deployment`

> You can't step in the same river twice
> *-Parmenides*

Since chains are append-only, and contract labels are unique,
it's not possible to deploy a contract more than once, or
deploy another contract with the same label as an existing one.

Enter the `Deployment` object, which keeps track of the contracts that you deploy.
You can get a `Deployment` instance by calling `defineDeployment`:

```typescript
import { Deployment, defineDeployment } from '@fadroma/core'
const deployment = await defineDeployment({ agent, name: 'testing' })
```

Then, you can use `deployment.contract` in place of `new Contract()`:

```typescript
const contractOne = deployment.contract({
  codeId: 1, name: 'name', initMsg: { parameter: 'value' }
})
```

Deployments add their names to the labels of deployed contracts:

```typescript
const clientToContractOne = await contractOne()
assert.equal(clientToContractOne.meta.label, 'testing/name')
assert.equal(clientToContractOne.meta.address, '(address #2)')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract:

```typescript
const anotherClientToContractOne = await contractOne()
assert.equal(clientToContractOne.address, anotherClientToContractOne.address)
```

This creates a new `Client` pointing to the same contract.

## Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const template = await deployment.template({ codeId: 2 })
const templateClientOne = await template.instance({ name: 'template-instance-1', initMsg: {} })
const templateClientTwo = await template.instance({ name: 'template-instance-2', initMsg: {} })
assert.equal(templateClientOne.address,    '(address #3)')
assert.equal(templateClientTwo.address,    '(address #4)')
assert.equal(templateClientOne.meta.label, 'testing/template-instance-1')
assert.equal(templateClientTwo.meta.label, 'testing/template-instance-2')
```

## Deploying multiple instances

To deploy multiple contract instances from the same code,
you can use templates.

You can pass either an array or an object to `template.instances`:

```typescript
const [ templateInsanceThree, templateClientFour ] = await template.instances([
  { name: 'name3', initMsg: { parameter: 'value3' } },
  { name: 'name4', initMsg: { parameter: 'value4' } },
])
const { templateClientFoo, templateClientBar } = await template.instances({
  templateClientFoo: { name: 'name5', initMsg: { parameter: 'value5' } },
  templateClientFoo: { name: 'name6', initMsg: { parameter: 'value6' } },
})
```

## Defining your contract's methods

Back to the `Client` class. Once you have some idea of what methods your contract will support,
you'll want to extend `Client` and implement them there:

```typescript
class MyClient extends Client {
  myMethod () {
    return this.execute({ my_method: {} })
  }
  myQuery () {
    return this.query({ my_query: {} })
  }
}

const templateWithCustomClient = deployment.template({ codeId: 2, client: MyClient })
const instanceWithCustomClient = templateWithCustomClient.instance({
  name: 'custom-client-contract', initMsg: {} 
})
const customClient = await instanceWithCustomClient
assert.ok(customClient instanceof MyClient)
assert.ok(await customClient.myMethod())
assert.ok(await customClient.myQuery())
```

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.
# Fadroma Core Spec: Contract label handling

```typescript
import assert from 'node:assert'
```

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

## Fetching the label

```typescript
import { fetchLabel, parseLabel, writeLabel } from '@fadroma/core'

let c = { address: 'addr' }
let a = { getLabel: () => Promise.resolve('label') }
assert.ok(await fetchLabel(c, a))
assert.ok(await fetchLabel(c, a, 'label'))
assert.rejects(fetchLabel(c, a, 'unexpected'))
```

## Contract metadata

The `Metadata` class is the base class of the
`ContractSource`->`ContractTemplate`->`ContractInstance` inheritance chain.

### `ContractInstance`

Represents a contract that is instantiated from a `codeId`.
  * Can have an `address`.
  * You can get a `Client` from a `ContractInstance` using
    the `getClient` family of methods.

```typescript
import { ContractInstance } from '@fadroma/core'
let instance: ContractInstance = new ContractInstance()
assert.ok(instance.asReceipt)
//assert.ok(await instance.define({ agent }).found)
//assert.ok(await instance.define({ agent }).deployed)
```

## Contract client

Represents an interface to an existing contract.
  * The default `Client` class allows passing messages to the contract instance.
  * **Implement a custom subclass of `Client` to define specific messages as methods**.
    This is the main thing to do when defining your Fadroma Client-based API.

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '@fadroma/core'
let client: Client = new Client(agent, 'some-address', 'some-code-hash')

assert.equal(client.agent,    agent)
assert.equal(client.address,  'some-address')
assert.equal(client.codeHash, 'some-code-hash')

client.fees = { 'method': 100 }

assert.equal(
  client.getFee('method'),
  100
)

assert.equal(
  client.getFee({'method':{'parameter':'value'}}),
  100
)

let agent2 = Symbol()
assert.equal(
  client.as(agent2).agent,
  agent2
)

client.agent = { execute: async () => 'ok' }
assert.equal(
  await client.execute({'method':{'parameter':'value'}}),
  'ok'
)
```

```typescript
/*let agent = {
  chain: { id: 'test' },
  getLabel:  () => Promise.resolve('label'),
  getHash:   () => Promise.resolve('hash'),
  getCodeId: () => Promise.resolve('id'),
}
let builder = {
  build: async x => x
}
let uploader = {
  agent,
  upload: async x => x
}*/
```


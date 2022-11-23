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
  async instantiate () { return { address: `(the address of instance #${++index})` } },
  async execute     () { return {} },
  async query       () { return {} }
})
```

## Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md)
(that is, a contract that is already built and uploaded):

```typescript
const aContract = new Contract({ codeId: 1, agent })
```

To deploy the contract uploaded as code ID 1, just call `aContract`, passing two things:
* an **instance ID**. This is the "friendly name" of the contract instance,
  and is used to construct its full unique label.
* an **init message**. This contains the "constructor parameters" that will be passed to the
  contract's init method.

```typescript
const aClient = await aContract('id1', { parameter: 'value' })
```

The call will resolve resolve to a `Client` instance. You can use this to talk to the deployed
contract by invoking its query and transaction methods.

```typescript
import { Client } from '@fadroma/core'
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(the address of instance #1)')
assert.equal(typeof aClient.query, 'function')
assert.equal(typeof aClient.exec,  'function')
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

Then, you can use `deployment.defineContract` in place of `new Contract()`:

```typescript
const theContract = deployment.defineContract({ codeId: 1 })
```

Deployments add their names to the labels of deployed contracts:

```typescript
const oneInstance = await theContract('name', { parameter: "value" })
assert.equal(oneInstance.meta.label, 'testing/name')
assert.equal(oneInstance.meta.address, '(the address of instance #2)')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract by name:

```typescript
const sameInstance = await theContract('name')
assert.equal(oneInstance.address, sameInstance.address)
```

This creates a new `Client` pointing to the same contract.

## Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const anotherInstance = await theContract({
  id:      'another-name',
  initMsg: { parameter: 'different-value' },
  agent:   agent
})
assert.equal(anotherInstance.address,    '(the address of instance #3)')
assert.equal(anotherInstance.meta.label, 'testing/another-name')
```

The above also demonstrates the alternate form of the deploy function.
Passing an object containing `{ name, initMsg }` is equivalent to passing
`name, initMsg`, with the difference that you can also define other
properties (e.g. deploy as a different agent).

## Deploying multiple instances

To deploy multiple contract instances from the same code,
you can use `theContract.many`. Where possible, this will deploy
all contracts as a single transaction.

You can pass either an array or an object to `theContract.many`:

```typescript
const [ c4, c5 ] = await theContract.many([
  [ 'name3', { parameter: 'value3' } ],
  { name: 'name4', initMsg: { parameter: 'value4' } },
])
```

Note that the keys of the object don't correspond to the names of the contracts,
so you still need to provide the names explicitly:

```typescript
const { c6, c7 } = await theContract.many({
  c6: ['name5', { parameter: 'value5' }],
  c7: { name: 'name6', initMsg: { parameter: 'value6' } },
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

const theOtherContract = deployment.defineContract({ codeId: 2, client: MyClient })
const d1 = await theOtherContract('my-other-contract', {})
assert.ok(d1 instanceof MyClient)
assert.ok(await d1.myMethod())
assert.ok(await d1.myQuery())
```

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.

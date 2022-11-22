# Fadroma: Contract deployment guide

```typescript
import assert from 'node:assert'
```

## The shape of the world

>“Tell me, as you promised!” implored the Master of space-time,
>hot tears thundering to the earth like mighty comets, “What is the shape of the universe?”
>“It is somewhat wheel-shaped,” said Aesma, which was a completely wrong answer.
>*-Abbadon*

To deploy a contract, you must first describe it.
You do this by creating a new instance of the class `Contract`:

```typescript
import { Contract } from '@fadroma/core'
const nullContract = new Contract()
```

This gives you an instance of the `Contract` class,
which can hold info about a specific deployed contract.

```typescript
assert(nullContract instanceof Contract)
```

The `Contract` instance returned by `new Contract()` is modified to be callable:

```typescript
assert(typeof nullContract === 'function')
```

Calling it returns a `Task`. This is a promise-like object which represents 
the action of deploying the contract:

```typescript
const deployingNullContract = nullContract()
assert(deployingNullContract.then instanceof Function)
```

However, unlike a `Promise`, the `Task` is only evaluated when you try to resolve it:

```typescript
assert.rejects(async () => await deployingNullContract)
```

Of course, the task will fail, because we haven't specified which contract to deploy,
or to what chain, or under what identity. Let's do that now.

## Some preparation

For the sake of this example, we'll create test-only instances of `Chain` and `Agent`,
and, for simplicity's sake, mock out the `Agent`'s methods:

```typescript
import { Chain } from '@fadroma/core'
const chain = new Chain('test')
const agent = Object.assign(await chain.getAgent(), {
  async instantiate () { return { address: `(the address of instance #${++index})` } },
  async execute     () { return {} },
  async query       () { return {} }
})
let index = 0
```

## Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md):

```typescript
const aContract = new Contract()({ codeId: 1, agent })
```

To deploy it, just call it, passing a **name** and a **init message**.
This will return a `Client` instance, which you use to talk to the
deployed contract.

```typescript
import { Client } from '@fadroma/core'
const aClient = await aContract('name1', { parameter: 'value' })
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(the address of instance #1)')
```

That's as simple as it gets!

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
  name:    'another-name',
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

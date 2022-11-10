# Fadroma: Contract deployment guide

```typescript
import assert from 'node:assert'
```

## The entry point of the deploy API

To deploy a contract, you begin with describing it.
You do this by calling the function `defineContract`.

```typescript
import { defineContract } from '@fadroma/core'
const emptyContract = defineContract()
```

This gives you an instance of the `Contract` class,
which can hold info about a specific deployed contract.

```typescript
import { Contract } from '@fadroma/core'
assert(emptyContract instanceof Contract)
```

## Magic patterns

Before we proceed to deploying a contract, let's take a minute to talk about the two
"magic patterns" powering Fadroma Ops. Those are **callable objects** and **lazy evaluation**.

> Thanks to them, you can get started quickly by **providing a minimum amount of information**,
> and with the least amount of syntactic overhead ("boilerplate") - but at the same time having
> quick **access to the maximum amount of information** that's available at any particular stage
> of your scripted workflow, as well as to "patch points" for customizing Fadroma's behavior.
>
> In other words, they keep the details out of your way - yet still at your fingertips when you need
> them. You don't need to know how exactly they work, but it's good to be aware that they are there,
> since they bend the usual rules *a tiny bit* in the interest of providing a clean and ergonomic API.

### Callable objects

Like any object, the one returned by `defineContract` has properties
describing some entity (in our case, a contract), and it also has
methods that you can call to access specific functionality.

However, it also includes an extra bit of magic - *the object itself is callable*.
That's right, the object is also a `Function`!

```typescript
import { Task } from '@hackbg/komandi'
assert(emptyContract() instanceof Task)
```

### Lazy evaluation

Calling the magic object/function hybrid which represents a contract (in the abstract),
will return a `Task`, which represents the act of deploying the contract (again in the abstract).

A `Task` works like a `Promise` - you can `await` it (or call its `then` method)
to resolve it and obtain the info about the deployed contract (such as its address).

However, unlike a `Promise`, a `Task` is **lazily evaluated**: it only begins deploying
when you first try to resolve it.

```typescript
assert(emptyContract().then instanceof Function)
```

The `Task` also has a `context` property which points back to the `Contract`
from which it was created:

```typescript
assert.equal(emptyContract().context, emptyContract)
```
console.log(emptyContract())

## Deploying a contract

Now that we've gotten the magic out of the way, let's start over - this time
providing all the necessary data for deploying a contract.

Of course, trying to deploy an empty `Contract` will fail,
because you still haven't specified which contract this is, or which chain
to deploy it to, or from what address to send the init transaction.

```typescript
assert.rejects(async () => await emptyContract())
```

First we'll create test-only instances of `Chain` and `Agent`,
with a mocked out `instantiate` method for simplicity:

```typescript
import { Chain } from '@fadroma/core'
const chain = new Chain('test')
const agent = await chain.getAgent()
agent.instantiate = () => ({ address: `the address of instance #${++index}` })
let index = 0
```

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md):

```typescript
const aContract = defineContract({ codeId: 1, agent })
```

To deploy it, just call it, passing a **name** and a **init message**.
This will return a `Client` instance, which you use to talk to the
deployed contract.

```typescript
import { Client } from '@fadroma/core'
const c1 = await aContract('name1', { parameter: 'value' })
assert.ok(c1 instanceof Client)
assert.equal(c1.address, 'the address of instance #1')
```

That's as simple as it gets!

## Interacting with contracts using the `Client`

The result of deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

### `client.meta`

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(c1.meta instanceof Contract)
assert.equal(c1.meta.deployedBy, agent.address)
```

### `client.agent`

By default, the `Client`'s `agent` property is equal to the `agent`
which deployed the contract. This property determines the address from
which subsequent transactions with that `Client` will be sent.

In case you want to deploy the contract as one identity, then interact
with it from another one as part of the same procedure, you can set `agent`
to another instance of `Agent`:

```typescript
assert.equal(c1.agent, agent)
c1.agent = await chain.getAgent()
```

## Retrieving existing contracts from the `Deployment`

> You can't step in the same river twice *-Parmenides*

Since chains are append-only, and contract labels are unique,
it's not possible to deploy a contract more than once, or
deploy another contract with the same label as an existing one.

Enter the `Deployment` object, which keeps track of the contracts that you deploy.
You can get a `Deployment` instance by calling `defineDeployment`:

```typescript
import { Deployment, defineDeployment } from '@fadroma/core'
const deployment = await defineDeployment({ agent, name: 'prod' })
```

Then, you can use `deployment.contract` in place of `defineContract`:

```typescript
const theContract = deployment.contract({ codeId: 1 })
```

Deployments add their names to the labels of deployed contracts:

```typescript
const oneInstance = await theContract('name', { parameter: "value" })
assert.equal(oneInstance.label, 'production/name')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract by name:

```typescript
const sameInstance = await theContract('name')
assert.deepEqual(oneInstance, sameInstance)
```

This creates a new `Client` pointing to the same contract.

## Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const c3 = await theContract({
  name:    'name2',
  initMsg: { parameter: 'different-value' },
  agent:   await chain.getAgent()
})
assert.equal(c3.address, 'the address of instance #2')
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
  [ 'name3', { parameter: 'value1' } ],
  { name: 'name4', initMsg: { parameter: 'value2' } },
])
```

Note that the keys of the object don't correspond to the names of the contracts,
so you still need to provide the names explicitly:

```typescript
const { c6, c7 } = await theContract.many({
  c6: ['name3', { parameter: 'value1' }],
  c7: { name: 'name4', initMsg: { parameter: 'value2' } },
})
```

## Defining your contract's methods

Back to the `Client` class. Once you have some idea of what methods your contract will support,
you'll want to extend `Client` and implement them there:

```typescript
class MyClient extends Client {
  myMethod () {
    return this.exec({ my_method: {} })
  }
  myQuery () {
    return this.query({ my_query: {} })
  }
}

const theOtherContract = defineContract({ codeId: 2, client: MyClient })
const d1 = await theOtherContract('my-other-contract', {})
assert.ok(d1 instanceof MyClient)
assert.ok(await d1.myMethod())
assert.ok(await d1.myQuery())
```

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.

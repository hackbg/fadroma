# Fadroma: Contract deployment guide

```typescript
import assert from 'node:assert'
```

## The general shape of the deploy API

To deploy a contract, you begin with describing it.
You do this by calling the function `defineContract`.

```typescript
import { defineContract } from '@fadroma/core'
const a = defineContract()
```

This gives you an instance of the `ContractInstance` class,
which can hold info about a specific deployed contract.

```typescript
import { ContractInstance } from '@fadroma/core'
assert(a instanceof ContractInstance)
```

The object returned by `defineContract` is a little special - it is *callable*,
like a `Function`. Calling it will return a `Task`. 

```typescript
import { Task } from '@hackbg/komandi'
assert(a() instanceof Task)
```

The `Task` has a `context` property which points back to the `ContractInstance`.

```typescript
assert(a().context === a)
```

A `Task` works like a `Promise` - you can `await` it (or call its `then` method)
to resolve it, obtaining the info about the deployed contract. However, unlike a `Promise`,
it's lazily evaluated - it only begins deploying when you first try to resolve it.

Of course, trying to deploy this empty `ContractInstance` will fail,
because you still haven't specified which contract this is, or which chain
to deploy it to, or from what address to send the init transaction.

```typescript
assert.rejects(async () => await a())
```

## Deploying a contract

Let's start over, this time providing all the necessary data for deploying a contract

First we'll create test-only instances of `Chain` and `Agent`,
with a mocked out `instantiate` method for simplicity:

```typescript
import { Chain } from '@fadroma/core'
const chain = new Chain('test')
const agent = await chain.getAgent()
let index = 1
agent.instantiate = () => ({ address: `the address of instance #${++index}` })
```

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md):

```typescript
const myContract = defineContract({ codeId: 1, agent })
```

To deploy it, just call it, passing a **name** and a **init message**.

```typescript
const client1 = await myContract('foo', { parameter: 'value' })
```

The result deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

```typescript
assert.ok(client1 instanceof Client)
assert.equal(client1.address, 'the address of instance #1')
assert.equal(client1.codeId, myContract.codeId)
assert.equal(client1.agent, agent)
```

The original `ContractInstance` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(foo.meta instanceof ContractInstance)
assert.equal(client1.meta.deployedBy, agent.address)
```

Since chains are append-only, and contract instances are unique, a deployed contract
is permanent - after you deploy it, then it stays up forever. In other words,
**deployment is idempotent**, so calling `deployMyContract` with the same name
will find and return the same instance:

```typescript
assert.deepEqual(await myContract('foo'), foo)
assert.equal((await myContract('foo')).address, foo.address)
```

What if you want to deploy multiple contracts of the same type?
That's easy, just give them different names:

```typescript
const bar = await myContract('bar', { parameter: 'value' })
assert.equal(foo.address, 'the address of instance #2')
```

The objects returned by deploy tasks are called `Client`s.
They contain the info that is needed to interact with the 
deployed contract. The metadata which describes the origin
of the contract (such as the source code and who deployed it)
is found on the `meta` property of the client.

```typescript
const baz = myContract('baz', {})
assert.equal((await baz).meta, baz)
```

You can extend the `Client` class to define your contract's custom methods:

```typescript
class MyClient extends Client {
  myMethod () {
    return this.exec({ my_method: {} })
  }
  myQuery () {
    return this.query({ my_query: {} })
  }
}

const myOtherContract = defineContract({ codeId: 2, client: MyClient })
```

You can also specify a different `agent` when deploying a contract:

```typescript
const quux = await myOtherContract({ name: 'quux', initMsg: {}, agent })
assert.ok(quux instanceof MyClient)
assert.equal(quux.agent, agent)
```

By default, each `Client` instance

```typescript
import assert from 'node:assert'
```

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

Let's start over, this time providing the necessary data.

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

To deploy it, just call it, passing a name and init message:

```typescript
const foo = await myContract('foo', { parameter: 'value' })

assert.equal(foo.address, 'the address of instance #1')
assert.equal(foo.deployedBy, agent.address)
assert.equal(foo.agent, agent)
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

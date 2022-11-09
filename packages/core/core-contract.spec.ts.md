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
assert(a().context instanceof ContractInstance)
```

A `Task` works like a `Promise` - you can `await` it (or call its `then` method)
to resolve it, obtaining the info about the deployed contract.

However, unlike a `Promise`, it's lazily evaluated - it only begins deploying
when you first `await` it (or call `then`).

Of course, trying to deploy this empty `ContractInstance` will reject,
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
agent.instantiate = () => ({ address: 'the address' })
```

```typescript
const c = defineContract({ codeId: 1, agent })
assert.ok(await c('test', {}))
```


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


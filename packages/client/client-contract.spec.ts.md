# Fadroma Client: Contracts

```typescript
import assert from 'node:assert'
import { Agent } from '.'
const agent = new Agent()
```

### Client

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '.'
let client: Client

assert.throws(()=>new Client().assertAddress())

assert.throws(()=>new Client().assertAgent())

assert.ok(typeof new Client(agent, 'some-address').address === 'string')

assert.ok(new Client(agent, 'some-address').agent instanceof Agent)
```

### Contract

The `Contract` class extends `Client` and can
build, upload, and instantiate smart contracts.

```typescript
import { Contract } from '.'
let builder:  Builder  = Symbol('the builder')
let uploader: Uploader = Symbol('the uploader')
let contract: Contract = new Contract({ builder, uploader })
assert.equal(contract.builder,  builder,
  'builder is set')
assert.equal(contract.uploader, uploader,
  'uploader is set')
```

### `ContractSource`

```typescript
import { ContractSource } from '.'
const source = new ContractSource({
  repository: Symbol(),
  revision:   Symbol(),
  dirty:      Symbol(),
  workspace:  Symbol(),
  crate:      Symbol(),
  features:   Symbol(),
  builder:    Symbol(),
  artifact:   Symbol(),
  codeHash:   Symbol(),
})
assert.notEqual(source, source.asSource)
assert.deepEqual(source, source.asSource)
assert.notEqual(new Contract(source).asSource, source)
assert.deepEqual(new Contract(source).asSource, source)
```

# Fadroma Client: Contracts

```typescript
import assert from 'node:assert'
```

The entities described here build on top of the logic
of the [connection layer](./client-connect.spec.ts.md).

```typescript
let agent = {
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
}
```

## Contract metadata

The `ContractMetadata` class is the base class of the
`ContractSource`->`ContractTemplate`->`ContractInstance` inheritance chain.

These classes describe contracts at different stages of their lifecycle.
They can be freely converted into each other, using the `asSource`, `asTemplate`
and `asInstance` getters.

Note that these getters return new copies of the data.

```typescript
import {
  ContractMetadata, ContractSource, ContractTemplate, ContractInstance
} from '@fadroma/client'
assert.ok(new ContractMetadata().asSource   instanceof ContractSource)
assert.ok(new ContractMetadata().asTemplate instanceof ContractTemplate)
assert.ok(new ContractMetadata().asInstance instanceof ContractInstance)
```

### `ContractSource`

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `ContractTemplate`.
  * You can create a new `ContractSource` using `asSource`.

```typescript
import { ContractSource } from '@fadroma/client'
let source: ContractSource = new ContractSource()
assert.ok(source.asSource instanceof ContractSource)
assert.notEqual(source.asSource, source)
assert.deepEqual(source.asSource, source)
assert.ok(await source.define({ builder }).compiled)
```

### `ContractTemplate`

Represents an uploaded contract that is not yet instantiated.
  * Can have `codeId` and `codeHash` but no `address`.
  * Instantiating a template creates a `ContractInstance`.
  * You can create a new `ContractTemplate` using `asTemplate`.

```typescript
import { ContractTemplate } from '@fadroma/client'
let template: ContractTemplate = new ContractTemplate()
assert.ok(template.asSource   instanceof ContractSource)
assert.ok(template.asTemplate instanceof ContractTemplate)
assert.notEqual(template.asTemplate,  template)
assert.deepEqual(template.asTemplate, template)
assert.ok(template.asReceipt)
assert.ok(template.asTemplate.define({ codeId: '123', codeHash: 'hash' }).asInfo)
const uploaded = template.define({ builder, uploader }).uploaded
assert.equal(uploaded, template.uploaded)
assert.ok(await uploaded)
assert.ok(template.instance() instanceof ContractInstance)
```

### `ContractInstance`

Represents a contract that is instantiated from a `codeId`.
  * Can have an `address`.
  * You can get a `Client` from a `ContractInstance` using
    the `getClient` family of methods.
  * You can create a new `ContractInstance` using `asInstance`.

```typescript
import { ContractInstance } from '@fadroma/client'
let instance: ContractInstance = new ContractInstance()
assert.ok(instance.asSource   instanceof ContractSource)
assert.ok(instance.asTemplate instanceof ContractTemplate)
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
import { Client } from '@fadroma/client'
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

## Handling of contract properties

```typescript
let c, a
```

### Labels

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

```typescript
import { fetchLabel, parseLabel, writeLabel } from '@fadroma/client'

c = { address: 'addr' }
a = { getLabel: () => Promise.resolve('label') }
assert.ok(await fetchLabel(c, a))
assert.ok(await fetchLabel(c, a, 'label'))
assert.rejects(fetchLabel(c, a, 'unexpected'))
```

### Code hashes

The code hash uniquely identifies the compiled code that underpins a contract.

```typescript
import { fetchCodeHash, assertCodeHash, codeHashOf } from '@fadroma/client'

assert.ok(assertCodeHash({ codeHash: 'hash' }))
assert.throws(()=>assertCodeHash({}))

c = { address: 'addr' }
a = { getHash: () => Promise.resolve('hash') }
assert.ok(await fetchCodeHash(c, a))
assert.ok(await fetchCodeHash(c, a, 'hash'))
assert.rejects(fetchCodeHash(c, a, 'unexpected'))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

### Code ids

The code id is also an unique identifier for compiled code uploaded to a chain.

```typescript
import { fetchCodeId } from '@fadroma/client'

c = { address: 'addr' }
a = { getCodeId: () => Promise.resolve('id') }
assert.ok(await fetchCodeId(c, a))
assert.ok(await fetchCodeId(c, a, 'id'))
assert.rejects(fetchCodeId(c, a, 'unexpected'))
```

### ICC structs

```typescript
import { templateStruct, linkStruct } from '@fadroma/client'
assert.deepEqual(
  templateStruct({ codeId: '123', codeHash: 'hash'}),
  { id: 123, code_hash: 'hash' }
)
assert.deepEqual(
  linkStruct({ address: 'addr', codeHash: 'hash'}),
  { address: 'addr', code_hash: 'hash' }
)
```

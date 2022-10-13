# Fadroma Client: Contracts

```typescript
import assert from 'node:assert'
import { Agent } from '.'
let agent = new Agent()
```

The following classes describe contracts at different stages of their lifecycle.

## `ContractSource`

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `ContractTemplate`.
  * You can create a new `ContractSource` using `asSource`.

```typescript
import { ContractSource } from '.'
let source: ContractSource = new ContractSource()
assert.ok(source.asSource instanceof ContractSource)
assert.notEqual(source.asSource, source)
assert.deepEqual(source.asSource, source)
```

## `ContractTemplate`

Represents an uploaded contract that is not yet instantiated.
  * Has `codeId` and `codeHash` but no `address`.
  * Instantiating a template creates a `ContractInstance`.
  * You can create a new `ContractTemplate` using `asTemplate`.

```typescript
import { ContractTemplate } from '.'
let template: ContractTemplate = new ContractTemplate()
assert.ok(template.asSource   instanceof ContractSource)
assert.ok(template.asTemplate instanceof ContractTemplate)
assert.notEqual(template.asTemplate,  template)
assert.deepEqual(template.asTemplate, template)
```

## `ContractInstance`

Represents a contract that is instantiated from a `codeId`.
  * As a minimum, has an `address`.
  * You can get a `Client` from a `ContractInstance` using
    the `getClient` family of methods.
  * You can create a new `ContractInstance` using `asInstance`.

```typescript
import { ContractInstance } from '.'
let instance: ContractInstance = new ContractInstance()
assert.ok(instance.asSource   instanceof ContractSource)
assert.ok(instance.asTemplate instanceof ContractTemplate)
```

## `Client`

Represents an interface to an existing contract.
  * The default `Client` class allows passing messages to the contract instance.
  * **Implement a custom subclass of `Client` to define specific messages as methods**.
    This is the main thing to do when defining your Fadroma Client-based API.

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '.'
let client: Client = new Client(agent, 'some-address', 'some-code-hash')
assert.ok(client.agent instanceof Agent)
assert.equal(client.address,  'some-address')
assert.equal(client.codeHash, 'some-code-hash')
```

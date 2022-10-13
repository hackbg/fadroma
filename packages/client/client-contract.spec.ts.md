# Fadroma Client: Contracts

```typescript
import assert from 'node:assert'
import { Agent } from '.'
let agent = new Agent()
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

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, notEqual, throws, rejects } from 'assert'
```

## `Deployment`, `Contract`, `Client`: deploying and operating contracts

### Deployment

```typescript
import { Deployment } from '.'
let deployment: Deployment = new Deployment()
deployment = new Deployment({ builder, uploader, agent })
contract   = deployment.contract()
equal(contract.context,  deployment)
equal(contract.builder,  builder)
equal(contract.uploader, uploader)
equal(contract.agent,    agent)
```

### Building and uploading

* To build a contract, specify at least a `crate`:

```typescript
contract = new Contract({ crate: 'crate' })
equal(contract.crate,    'crate')
equal(contract.revision, undefined)
```

* You can also specify a past `revision` of the crate source by Git reference.

```typescript
contract = new Contract({ crate: 'crate', revision: 'ref' })
equal(contract.crate,    'crate')
equal(contract.revision, 'ref')
```

```typescript
import { Builder } from './client-deploy'
builder = new class TestBuilder extends Builder {
  async build (source: Source): Promise<Contract> { return new Contract(source) }
}
```

### `Uploader`: Uploading artifacts

```typescript
import { Uploader } from './client-deploy'

const artifact = new URL('file:///tmp/artifact.wasm')
equal(new Contract({ artifact }).artifact, artifact)
agent = new (class TestAgent extends Agent {
  instantiate (source: Contract): Promise<Client> { return new Client(source) }
})({ chain: { id: 'chain' } })
uploader = new (class TestUploader extends Uploader {
  upload (template: Contract): Promise<Contract> { return new Contract(template) }
})(agent)
```

### Deploying a smart contract

```typescript
const options = {
  name:  'empty',
  crate: 'empty',
  agent,
  builder,
  uploader,
  deployment: new Deployment()
}

ok(new Contract(options).deploy(),
  'deploying without init msg?')

ok(await new Contract(options).deploy({ init: 'arg' })
  'deploy pre-configured contract with init msg')

ok(await new Contract(options).deploy(()=>({ init: 'arg' })),
  'deploy pre-configured contract with lazy init msg')

ok(await new Contract(options).deploy(async ()=>({ init: 'arg' })),
  'deploy pre-configured contract with laziest init msg')

ok(await new Contract({ ...options, crate: 'crate', ref: 'ref' }).deploy([]),
  'deploy from source')
```

### Connecting to a smart contract

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
rejects(()=>new Contract('Name').get(),
  'naming a contract that is not in the deployment throws')

ok(agent.getClient(Client),
  'get a contract client from the agent')
```

### `ClientError`: contract error conditions

Contract errors inherit from **ClientError** and are defined as its static properties.

```typescript
import { ClientError } from '.'
for (const kind of Object.keys(ClientError)) {
  ok(new ClientError[kind] instanceof ClientError, 'constructing each error')
}
```

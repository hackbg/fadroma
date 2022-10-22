# Fadroma Deploy Spec

```typescript
import assert from 'node:assert'
```

## Contract slot

```typescript
import { ContractSlot } from '@fadroma/client'
let contract: ContractSlot
```

The `ContractSlot` slot class extends [`ContractInstance`](./client-contract.spec.ts.md#ContractInstance)
and has access to all logic and state that is needed
to build, upload, instantiate, and retrieve contracts.

```typescript
import type { Agent, Builder, Uploader } from '@fadroma/client'
let agent:    Agent    = { instantiate () { return { address: Symbol('the address') } } }
let builder:  Builder  = Symbol('the builder')
let uploader: Uploader = Symbol('the uploader')
```

Contracts are **value objects**. They can be

* constructed from keyword arguments:

```typescript
contract = new ContractSlot({ agent, builder, uploader })
assert.equal(contract.agent,    agent,    'agent is set')
assert.equal(contract.builder,  builder,  'builder is set')
assert.equal(contract.uploader, uploader, 'uploader is set')
```

* incrementally populated:

```typescript
contract = new ContractSlot().define({ agent }).define({ builder }).define({ uploader })
assert.equal(contract.agent,    agent,    'agent is defined')
assert.equal(contract.builder,  builder,  'builder is defined')
assert.equal(contract.uploader, uploader, 'uploader is defined')
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
deployment.showStatus()
await deployment.buildMany([])
await deployment.uploadMany([])
await deployment.subsystem('', '', class {})
await deployment.attach({}, '', '')
contract = deployment.contract()
equal(contract.context,  deployment)
equal(contract.builder,  builder)
equal(contract.uploader, uploader)
equal(contract.agent,    agent)

import { DeployStore } from '.'
new DeployStore()
```

### Building and uploading

* To build a contract, specify at least a `crate`:

```typescript
contract = new ContractSlot({ crate: 'crate' })
equal(contract.crate,    'crate')
equal(contract.revision, undefined)
```

* You can also specify a past `revision` of the crate source by Git reference.

```typescript
contract = new ContractSlot({ crate: 'crate', revision: 'ref' })
equal(contract.crate,    'crate')
equal(contract.revision, 'ref')
```

### `Uploader`: Uploading artifacts

```typescript
const artifact = new URL('file:///tmp/artifact.wasm')
equal(new ContractSlot({ artifact }).artifact, artifact)
```

### Deploying a smart contract

```typescript
const options = {
  name:  'empty',
  crate: 'empty',
  agent,
  builder,
  uploader,
  deployment: new Deployment(),
  codeId: Infinity,
  initMsg: {}
}

ok(new ContractSlot(options).deploy())

ok(await new ContractSlot(options).deploy({ init: 'arg' })
  'deploy pre-configured contract with init msg')

ok(await new ContractSlot(options).deploy(()=>({ init: 'arg' })),
  'deploy pre-configured contract with lazy init msg')

ok(await new ContractSlot(options).deploy(async ()=>({ init: 'arg' })),
  'deploy pre-configured contract with laziest init msg')

ok(await new ContractSlot({ ...options, crate: 'crate', ref: 'ref' }).deploy([]),
  'deploy from source')
```

### Connecting to a smart contract

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
throws(()=>new ContractSlot('Name').getClient(),
  'naming a contract that is not in the deployment throws')
```

### `ClientError`: contract error conditions

Contract errors inherit from **ClientError** and are defined as its static properties.

```typescript
import { ClientError } from '.'
for (const kind of Object.keys(ClientError)) {
  ok(new ClientError[kind] instanceof ClientError, 'constructing each error')
}
```

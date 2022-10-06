# Fadroma Client Spec

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
equal(contract.deployment, deployment)
equal(contract.builder,    builder)
equal(contract.uploader,   uploader)
equal(contract.agent,      agent)
```

### Building and uploading

```typescript
contract = new Contract({ crate: 'crate' })
equal(contract.crate,    'crate')
equal(contract.revision, 'HEAD')

contract = new Contract({ crate: 'crate', revision: 'ref' })
equal(contract.crate,    'crate')
equal(contract.revision, 'ref')

builder = new class TestBuilder extends Builder {
  async build (source: Source): Promise<Contract> { return new Contract(source) }
}
```

### `Uploader`: Uploading artifacts

```typescript
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

## `Fee`: Specifying per-transaction gas fees

```typescript
import { Fee } from '.'
```

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

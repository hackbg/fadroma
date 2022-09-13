---
literate: typescript
---
# Fadroma Client Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, notEqual, throws, rejects } from 'assert'
```

## Chain

User selects chain by instantiating a `Chain` object.

```typescript
import { Chain } from '.'
let chain: Chain = new Chain('any', { url: 'example.com' })
assert.equal(chain.id,  'any')
assert.equal(chain.url, 'example.com')
chain = new Chain('any', { mode: Chain.Mode.Mocknet })
assert(chain.isMocknet && chain.devMode)
chain = new Chain('any', { mode: Chain.Mode.Devnet })
assert(chain.isDevnet  && chain.devMode)
chain = new Chain('any', { mode: Chain.Mode.Testnet })
assert(chain.isTestnet && !chain.devMode)
chain = new Chain('any', { mode: Chain.Mode.Mainnet })
assert(chain.isMainnet && !chain.devMode)
```

## Agent

User authenticates (=authorizes agent)
by obtaining an `Agent` instance from the `Chain`.
* Pass it a `mnemonic` to authenticate.
* This is asynchronous to allow for async crypto functions to run,
  as required by platform APIs.

```typescript
import { Agent } from '.'
let agent: Agent = await chain.getAgent({ mnemonic: undefined })
assert(agent instanceof Agent)
```

### Getting an `Agent` from a `Devnet`'s genesis account

When using devnet, you can also get an agent from a named genesis account:

```typescript
import type { DevnetHandle } from '.'
const node: DevnetHandle = { getGenesisAccount () { return {} }, respawn () {} }
chain = new Chain('devnet', { mode: Chain.Mode.Devnet, node })
assert(await chain.getAgent({ name: 'Alice' }) instanceof Agent)
```

### Waiting for block height to increment

```
//todo
```

### Native token operations

```typescript
// getting agent's balance in native tokens
const balances = { 'foo': '1', 'bar': '2' }
agent = new class TestAgent1 extends Agent {
  get defaultDenom () { return 'foo' }
  getBalance (denom = this.defaultDenom) {
    return Promise.resolve(balances[denom] || '0')
  }
}
equal(await agent.balance,           '1')
equal(await agent.getBalance(),      '1')
equal(await agent.getBalance('foo'), '1')
equal(await agent.getBalance('bar'), '2')
equal(await agent.getBalance('baz'), '0')
// to one recipient
// TODO
// to many recipients in one transaction
// TODO
```

### Smart contract operations

* **Instantiating** a contract
* **Executing** a transaction
* **Querying** a contract

```typescript
console.info('api methods')
agent = new class TestAgent3 extends Agent { async instantiate () { return {} } }
assert.ok(await agent.instantiate(null, null, null, null))
agent = new class TestAgent4 extends Agent { async execute () { return {} } }
assert.ok(await agent.execute())
agent = new class TestAgent5 extends Agent { async query () { return {} } }
assert.ok(await agent.query())
```

### Bundle

Create one with `Agent#getBundle()` then use with `Client`
to combine various messages in a single transaction.

```typescript
import { Bundle } from '.'
let bundle: Bundle
class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}
```

```typescript
equal(await new TestBundle(agent).wrap(async()=>{}), 'submitted')
equal(await new TestBundle(agent).wrap(async()=>{}, undefined, true), 'saved')
```

```typescript
import { Client } from '.'
bundle = new Bundle({ chain: {}, checkHash () { return 'hash' } })
ok(bundle.getClient(Client, '') instanceof Client)
rejects(()=>bundle.query())
rejects(()=>bundle.upload())
rejects(()=>bundle.uploadMany())
rejects(()=>bundle.sendMany())
rejects(()=>bundle.send())
rejects(()=>bundle.getBalance())
throws(()=>bundle.height)
throws(()=>bundle.nextBlock)
throws(()=>bundle.balance)
equal(await bundle.execute({}), bundle)
equal(bundle.id, 1)
ok(await bundle.instantiateMany(new Contract(), []))
ok(await bundle.instantiateMany(new Contract(), [['label', 'init']]))
ok(await bundle.instantiate(new Contract(), 'label', 'init'))
equal(await bundle.checkHash(), 'hash')
```

```typescript
bundle = new TestBundle(agent)
deepEqual(bundle.msgs, [])
equal(bundle.id, 0)
bundle.add(null)
deepEqual(bundle.msgs, [null])
equal(bundle.id, 1)
```

```typescript
bundle = new Bundle(agent)
throws(()=>bundle.assertCanSubmit())
bundle.msgs.push(null)
ok(bundle.assertCanSubmit())
```

```typescript
bundle = new TestBundle(agent)
equal(await bundle.run(""),       "submitted")
equal(await bundle.run("", true), "saved")
equal(bundle.depth, 0)
bundle = bundle.bundle()
equal(bundle.depth, 1)
equal(await bundle.run(), null)
```

```typescript
console.info('get bundle from agent')
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
ok(bundle instanceof Bundle)

console.info('auto use bundle in agent for instantiateMany')
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
await agent.instantiateMany(new Contract(), [])
await agent.instantiateMany(new Contract(), [], 'prefix')
```

## `Deployment`, `Contract`, `Client`: deploying and operating contracts

### Client

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '.'
let client: Client

throws(()=>new Client().assertAddress())

throws(()=>new Client().assertAgent())

ok(new Client(agent, { address: 'some-address' }).assertAddress().assertAgent() instanceof Agent)
```

### Contract

The `Contract` class extends `Client` and can
build, upload, and instantiate smart contracts.

```typescript
import { Contract, Builder, Uploader } from '.'
let builder:  Builder  = Symbol()
let uploader: Uploader = Symbol()
let contract: Contract = new Contract({ builder, uploader })
equal(contract.builder,  builder,
  'builder is set')
equal(contract.uploader, uploader,
  'uploader is set')
equal(contract, contract.as(),
  'contract.as returns copy')
notEqual(contract, contract.as(agent),
  'contract.as returns copy')
contract = contract.as(agent)
equal(contract.builder,  builder,
  'builder still set')
equal(contract.uploader, uploader,
  'uploader still set')
equal(contract.agent,    agent,
  'agent also set')
```

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
equal(contract.crate,  'crate')
equal(contract.gitRef, 'HEAD')

contract = new Contract({ crate: 'crate', gitRef: 'ref' })
equal(contract.crate,  'crate')
equal(contract.gitRef, 'ref')

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
})({ id: 'chain' })
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

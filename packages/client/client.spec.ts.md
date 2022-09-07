# Fadroma Client Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, throws, rejects } from 'assert'
```

## Chain

1. User selects chain by instantiating a `Chain` object.

```typescript
import { Chain } from '.'
let chain: Chain
```

### Chain config

```typescript
chain = new Chain('any', { url: 'example.com' })
assert.equal(chain.id,  'any')
assert.equal(chain.url, 'example.com')
```

### Chain modes

```typescript
import { ChainMode } from '.'

chain = new Chain('any', { mode: ChainMode.Mainnet })
assert(chain.isMainnet)

chain = new Chain('any', { mode: ChainMode.Testnet })
assert(chain.isTestnet && !chain.isMainnet)

chain = new Chain('any', { mode: ChainMode.Devnet })
assert(chain.isDevnet  && !chain.isMainnet && !chain.isTestnet)

chain = new Chain('any', { mode: ChainMode.Mocknet })
assert(chain.isMocknet && !chain.isMainnet && !chain.isDevnet)
```

## Agent

User authenticates (=authorizes agent)
by obtaining an `Agent` instance from the `Chain`.

```typescript
import { Agent } from '.'
let agent: Agent
```

### Getting an `Agent` from a `Chain` by mnemonic

* Getting an agent from a chain
  * This is asynchronous to allow for async crypto functions to run.

```typescript
assert(await chain.getAgent({}) instanceof Agent)
```

### Getting an `Agent` from a `Devnet`'s genesis account

* When using devnet, you can also get an agent from a named genesis account:

```typescript
assert(await new Chain('devnet', {
  mode: ChainMode.Devnet,
  node: { getGenesisAccount () { return {} }, respawn () {} }
}).getAgent({ name: 'Alice' }) instanceof Agent)
```

### Waiting for block height to increment

* **Waiting** until the block height has incremented

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
equal(await new TestBundle().wrap(async()=>{}), 'submitted')
equal(await new TestBundle().wrap(async()=>{}, undefined, true), 'saved')
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
ok(await bundle.instantiateMany([]))
ok(await bundle.instantiateMany([[{}]]))
ok(await bundle.instantiate({}))
equal(await bundle.checkHash(), 'hash')
```

```typescript
bundle = new TestBundle()
deepEqual(bundle.msgs, [])
equal(bundle.id, 0)
bundle.add(null)
deepEqual(bundle.msgs, [null])
equal(bundle.id, 1)
```

```typescript
bundle = new Bundle()
throws(()=>bundle.assertCanSubmit())
bundle.msgs.push(null)
ok(bundle.assertCanSubmit())
```

```typescript
bundle = new TestBundle()
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
await agent.instantiateMany([])
await agent.instantiateMany([], 'prefix')
```

## `Client`: Instantiating and operating smart contracts

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '.'
let contract: Client
throws(()=>new Client().assertAddress())
throws(()=>new Client().assertAgent())
ok(new Client(agent, { address: true }).assertAddress().assertAgent() instanceof Agent)
```

### `Source`, `Builder`: compiling smart contracts

```typescript
import { Source, Builder } from '.'
let source:  Source
let builder: Builder = new class TestBuilder extends Builder {
  async build (source: Source): Promise<Contract> {
    return new Contract(source)
  }
}
```

### `Contract`, `Uploader`: uploading smart contracts

```typescript
import { Contract } from '.'
let template: Contract
equal(new Contract('crate').crate,     'crate')
equal(new Contract('crate@ref').crate, 'crate')
equal(new Contract('crate@ref').ref,   'ref')
const url = new URL('file:///tmp/artifact.wasm')
equal(new Contract(url).artifact, url)
```

```typescript
import { Uploader } from '.'
let uploader: Uploader

agent = new (class TestAgent extends Agent {
  instantiate (source: Contract): Promise<Client> {
    return new Client(source)
  }
})({ id: 'chain' })

uploader = new (class TestUploader extends Uploader {
  upload (template: Contract): Promise<Contract> {
    return new Contract(template)
  }
})(agent)

```

### Deploying a smart contract

```typescript
const options = { crate: 'empty', agent, builder, uploader, deployment: { get () {} } }
ok(await new Client('Name', options).deploy())
ok(await new Client('Name', options).getOrDeploy({ init: 'arg' }))
ok(await new Client('Name', options).getOrDeploy(()=>({ init: 'arg' })))
ok(await new Client('Name', options).getOrDeploy(async ()=>({ init: 'arg' })))
```

### Connecting to a smart contract

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
throws(()=>new Client('Name').get())
ok(await new Client('Name').getOr(()=>true))
// get a contract client from the agent
ok(agent.getClient(Client))
```

### `ClientError`: contract error conditions

Contract errors inherit from **ClientError** and are defined as its static properties.

```typescript
import { ClientError } from '.'
for (const kind of Object.keys(ClientError)) {
  ok(new ClientError[kind] instanceof ClientError)
}
```

## `Contracts`: managing multiple contracts

```typescript
import { Contracts } from '.'

ok(new Contracts()) // empty

ok(await new Contracts([], { Client, builder, uploader }).deployMany('crate@ref', [], agent))
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

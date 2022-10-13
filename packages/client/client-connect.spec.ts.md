# Fadroma Client: Connecting

```typescript
import assert from 'node:assert'
```

## `chain: Chain`

This package provides the abstract base class, `Chain`.

To interact with a chain, select it by instantiating
a corresponding subclass provided by e.g. `@fadroma/connect`,
using the following syntax:

```typescript
import { Chain } from '.'
let chain: Chain = new Chain('id', { url: 'example.com' })
assert.equal(chain.id,  'id')
assert.equal(chain.url, 'example.com')
```

### `chain.mode: ChainMode`

`ChainMode` a.k.a. `Chain.Mode` is an enumeration of the
different kinds of chains connection modes that are supported:

* **Mocknet** is a fast, nodeless way of executing contract code
  in the local JS WASM runtime.
* **Devnet** uses a real chain node, booted up temporarily in
  a local environment.
* **Testnet** is a persistent remote chain used for testing.
* **Mainnet** is the production chain where value is stored.

```typescript
assert(new Chain('any', { mode: Chain.Mode.Mocknet }).isMocknet)
assert(new Chain('any', { mode: Chain.Mode.Devnet  }).isDevnet)
assert(new Chain('any', { mode: Chain.Mode.Testnet }).isTestnet)
assert(new Chain('any', { mode: Chain.Mode.Mainnet }).isMainnet)
```

### `chain.devMode: boolean`

The `devMode` flag corresponds to whether you can reset the chain
and start over. This is true for mocknet and devnet, but not for
testnet or mainnet.

```typescript
assert(new Chain('any', { mode: Chain.Mode.Mocknet }).devMode)
assert(new Chain('any', { mode: Chain.Mode.Devnet  }).devMode)
assert(!new Chain('any', { mode: Chain.Mode.Testnet }).devMode)
assert(!new Chain('any', { mode: Chain.Mode.Mainnet }).devMode)
```

`devMode` can be used to determine whether e.g.
to deploy mocks of 3rd party contracts or use the official
testnet and mainnet deployments of those.

## Agent

To transact on the chain, you need to select an identity (wallet).
In Fadroma, you do this by obtaining an `Agent` from the `Chain` object.

* To authenticate as a specific address, pass a `mnemonic` to the `getAgent` call.
  If you don't a random mnemonic and address will be generated.

```typescript
import { Agent } from '.'
let agent: Agent = await chain.getAgent()

assert(agent instanceof Agent)
assert(agent.chain === chain)
```

Getting an Agent is an asynchronous operation because of the
underlying platform APIs being async.

### Genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
const mockNode = { getGenesisAccount () { return {} }, respawn () {} }
chain = new Chain('id', { mode: Chain.Mode.Devnet, node: mockNode })
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

assert.equal(await agent.balance,           '1')
assert.equal(await agent.getBalance(),      '1')
assert.equal(await agent.getBalance('foo'), '1')
assert.equal(await agent.getBalance('bar'), '2')
assert.equal(await agent.getBalance('baz'), '0')
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
assert(await agent.instantiate(null, null, null, null))
agent = new class TestAgent4 extends Agent { async execute () { return {} } }
assert(await agent.execute())
agent = new class TestAgent5 extends Agent { async query () { return {} } }
assert(await agent.query())
```

### `agent.bundle(): Bundle extends Agent`

To submit multiple messages as a single transaction, you can
use Bundles. A `Bundle` is a special kind of `Agent` that
does not broadcast messages immediately. Instead, messages
are collected inside the bundle until the caller explicitly
submits them (or saves them for manual multisig signing).

```typescript
import { Bundle } from '.'
let bundle: Bundle
class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}
```

Bundles implement the same overall APIs as Agents.
Some operations, however, don't make sense in the context of
a Bundle. Most importantly, querying any state from the chain
must be done either before or after the bundle.

```typescript
import { Client } from '.'
bundle = new Bundle({ chain: {}, checkHash () { return 'hash' } })

assert(bundle.getClient(Client, '') instanceof Client)
assert.equal(await bundle.execute({}), bundle)
assert.equal(bundle.id, 1)
//assert(await bundle.instantiateMany({}, []))
//assert(await bundle.instantiateMany({}, [['label', 'init']]))
//assert(await bundle.instantiate({}, 'label', 'init'))
assert.equal(await bundle.checkHash(), 'hash')

assert.rejects(()=>bundle.query())
assert.rejects(()=>bundle.upload())
assert.rejects(()=>bundle.uploadMany())
assert.rejects(()=>bundle.sendMany())
assert.rejects(()=>bundle.send())
assert.rejects(()=>bundle.getBalance())
assert.throws(()=>bundle.height)
assert.throws(()=>bundle.nextBlock)
assert.throws(()=>bundle.balance)
```

To create and submit a bundle in a single expression,
you can use `bundle.wrap(async (bundle) => { ... })`:

```typescript
assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}), 'submitted')

assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}, undefined, true), 'saved')
```

```typescript
bundle = new TestBundle(agent)
assert.deepEqual(bundle.msgs, [])
assert.equal(bundle.id, 0)
assert.throws(()=>bundle.assertMessages())

bundle.add({})
assert.deepEqual(bundle.msgs, [{}])
assert.equal(bundle.id, 1)
assert.ok(bundle.assertMessages())
```

```typescript
bundle = new TestBundle(agent)
assert.equal(await bundle.run(""),       "submitted")
assert.equal(await bundle.run("", true), "saved")
assert.equal(bundle.depth, 0)

bundle = bundle.bundle()
assert.equal(bundle.depth, 1)
assert.equal(await bundle.run(), null)
```

```typescript
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
assert(bundle instanceof Bundle)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
//await agent.instantiateMany(new Contract(), [])
//await agent.instantiateMany(new Contract(), [], 'prefix')
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

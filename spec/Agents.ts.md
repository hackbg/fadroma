# Agents: identifying to a chain

```typescript
import assert from 'node:assert'
```

To transact on the chain, you need to select an identity (wallet).
In Fadroma, you do this by obtaining an `Agent` from the `Chain` object.

* To authenticate as a specific address, pass a `mnemonic` to the `getAgent` call.
  If you don't a random mnemonic and address will be generated.

```typescript
import { Chain, Agent } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
let agent: Agent = await chain.getAgent()

assert(agent instanceof Agent)
assert(agent.chain === chain)
```

Getting an Agent is an asynchronous operation because of the
underlying platform APIs being async.

## Waiting for block height to increment

```
//todo
```

## Native token operations

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

## Smart contract operations

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

## Genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
const mockNode = { getGenesisAccount () { return {} }, respawn () {} }
chain = new Chain('id', { mode: Chain.Mode.Devnet, node: mockNode })
assert(await chain.getAgent({ name: 'Alice' }) instanceof Agent)
```


# Fadroma Client

Base layer for isomorphic contract clients.

1. User selects chain by instantiating a `Chain` object.
2. User authorizes agent by obtaining an `Agent` instance from the `Chain`.
3. User interacts with contract by obtaining an instance of the
   appropriate `Client` subclass from the authorized `Agent`.

[![](https://img.shields.io/npm/v/@fadroma/client?color=%2365b34c&label=%40fadroma%2Fclient&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/client)

## Chain, Agent, Client

Base layer for isomorphic contract clients.

1. User selects chain by instantiating a `Chain` object.
2. User authorizes agent by obtaining an `Agent` instance from the `Chain`.
3. User interacts with contract by obtaining an instance of the
   appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Chain, Agent, Client } from '.'
```

### Chain

```typescript
let chain: Chain
```

* Chain config

```typescript
chain = new Chain('any', { url: 'example.com' })
assert.equal(chain.id,  'any')
assert.equal(chain.url, 'example.com')
```

* Chain modes

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

* Chain variants
  * `LegacyScrt`: creates secretjs@0.17.5 based agent using lcd/amino
  * `Scrt`: creates secretjs@beta based agent using grpc

```typescript
const supportedChains = [
  Fadroma.Scrt,
  Fadroma.LegacyScrt
  //Fadroma.Mocknet,
]

for (const Chain of supportedChains) {
  ok(await new Chain('main', { mode: ChainMode.Mainnet }))
  ok(await new Chain('test', { mode: ChainMode.Testnet }))
  const node = { chainId: 'scrt-devnet', url: 'http://test:0' }
  const chain = await new Chain('dev', { mode: ChainMode.Devnet, node })
  ok(chain)
  equal(chain.node, node)
  equal(chain.url,  node.url)
  equal(chain.id,   node.chainId)
}
```

### Agent

```typescript
let agent: Agent
```

* Getting an agent from a chain
  * This is asynchronous to allow for async crypto functions to run.

```typescript
agent = await chain.getAgent({})
assert(agent instanceof Agent)
for (const Chain of supportedChains) {
  const chain    = new Chain('test', {})
  const mnemonic = Testing.mnemonics[0]
  const agent    = await chain.getAgent({ mnemonic })
  assert.equal(agent.chain,    chain)
  assert.equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
}
```

* When using devnet, you can also get an agent from a named genesis account:

```typescript
chain = new Chain('devnet', {mode: ChainMode.Devnet, node: {getGenesisAccount(){return{}}}})
agent = await chain.getAgent({ name: 'Alice' })
```

* **Waiting** until the block height has incremented

```typescript
// waiting for next block
for (const Chain of [Fadroma.LegacyScrt]) {
  await Testing.withMockAPIEndpoint(async endpoint => {
    const chain    = new Chain('test', { url: endpoint.url })
    const mnemonic = Testing.mnemonics[0]
    const agent    = await chain.getAgent({ mnemonic })
    const [ {header:{height:block1}}, account1, balance1 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    await agent.nextBlock
    const [ {header:{height:block2}}, account2, balance2 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    equal(block1 + 1, block2)
    deepEqual(account1, account2)
    deepEqual(balance1, balance2)
  })
}
```

* **Sending** native tokens

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
// native token balance and transactions
for (const Chain of [Fadroma.LegacyScrt]) {
  continue // TODO
  await withMockAPIEndpoint(async endpoint => {
    const chain     = new Chain('test', { url: endpoint.url })
    const mnemonic1 = Testing.mnemonics[0]
    const mnemonic2 = Testing.mnemonics[1]
    const [agent1, agent2] = await Promise.all([
      chain.getAgent({mnemonic: mnemonic1}),
      chain.getAgent({mnemonic: mnemonic2}),
    ])
    endpoint.state.balances = {
      uscrt: {
        [agent1.address]: BigInt("2000"),
        [agent2.address]: BigInt("3000")
      }
    }
    equal(await agent1.balance, "2000")
    equal(await agent2.balance, "3000")
    await agent1.send(agent2.address, "1000")
    equal(await agent1.balance, "1000")
    equal(await agent2.balance, "4000")
    await agent2.send(agent1.address, 500)
    equal(await agent1.balance, "1500")
    equal(await agent2.balance, "3500")
  })
}
// to one recipient
// TODO
// to many recipients in one transaction
// TODO
```

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

* **Variants:**
  * **LegacyScrt.Agent** a.k.a. **LegacyScrtAgent**: uses secretjs 0.17.5
  * **Scrt.Agent** a.k.a. **ScrtRPCAgent**: which uses the new gRPC API
    provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
    supported in secretjs 0.17.5 and older.

```typescript
for (const Chain of supportedChains) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: Testing.mnemonics[0] })
  assert(agent instanceof Chain.Agent, `${Chain.name}#getAgent returns Promise<${Chain.Agent.name}>`)
}
```

* **Bundling** transactions:

```typescript
import { Bundle } from '.'
let bundle: Bundle
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

console.info('bundles implemented on all chains')
for (const Chain of supportedChains) {
  const mnemonic = Testing.mnemonics[0]
  const agent    = await new Chain('🤡', {}).getAgent({ mnemonic })
  const bundle   = agent.bundle()
  ok(bundle instanceof Chain.Agent.Bundle)
}
```

### Client

```typescript
let client: Client
```

The `Client` class allows you to transact with a specific smart contract
deployed on a specific [Chain](./Chain.spec.ts.md), as a specific [Agent](./Agent.spec.ts.md).

```typescript
console.info('get client from agent')
client = agent.getClient()
ok(client)
```

### Specifying per-transaction gas fees

  * `client.fee` is the default fee for all transactions
  * `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
  * `client.withFee(fee: IFee)` allows the caller to override the default fees.
    Calling it returns a new instance of the Client, which talks to the same contract
    but executes all transactions with the specified custom fee.

```typescript
import { ScrtGas as LegacyScrtGas } from '@fadroma/client-scrt-amino'
import { ScrtGas }                  from '@fadroma/client-scrt-grpc'
console.info('gas implemented on all chains')
for (const Gas of [LegacyScrtGas, ScrtGas]) {
  // scrt gas unit is uscrt
  equal(ScrtGas.denom, 'uscrt')
  // default gas fees are set
  ok(ScrtGas.defaultFees.upload instanceof ScrtGas)
  ok(ScrtGas.defaultFees.init   instanceof ScrtGas)
  ok(ScrtGas.defaultFees.exec   instanceof ScrtGas)
  ok(ScrtGas.defaultFees.send   instanceof ScrtGas)
  // can create custom gas fee specifier
  const fee = new ScrtGas(123)
  deepEqual(fee.amount, [{amount: '123', denom: 'uscrt'}])
}
```

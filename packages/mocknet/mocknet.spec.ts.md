# Fadroma Mocknet Specification

```typescript
import assert from 'assert'
import * as Testing from '../../TESTING.ts.md'
```

The Fadroma Mocknet is a pure Node.js implementation of the API and environment
that Cosmos contracts expect. Because it does not contain a distributed consensus
mechanism, it allows the interaction of multiple smart contracts to be tested
much faster than with a devnet or testnet.

## Mocknet as Chain

```typescript
import { Chain, Agent, Client, Contract, ContractTemplate, ContractInstance } from '@fadroma/core'
let chain:     Chain
let agent:     Agent
let template:  Contract
let template2: Contract
let instance:  Contract
let client:    Client
```

Initialize and spawn agent:

```typescript
import { Mocknet } from '.'
chain = new Mocknet()
assert.equal(await chain.height, 0)

agent = await chain.getAgent()
chain.balances[agent.address] = 1000
assert.ok(agent instanceof Mocknet.Agent)
assert.equal(await chain.getBalance(agent.address), 1000)
assert.equal(agent.defaultDenom, chain.defaultDenom)
assert.ok(await agent.account)
assert.ok(!await agent.send())
assert.ok(!await agent.sendMany())
```

Upload WASM blob, returning code ID:

```typescript
import { pathToFileURL } from 'url'
chain     = new Mocknet()
agent     = await chain.getAgent()
template  = await agent.upload(Testing.examples['Echo'].data)
template2 = await agent.upload(Testing.examples['KV'].data)

assert.equal(template2.codeId,  String(Number(template.codeId) + 1))
```

Instantiate and call a contract:

```typescript
chain    = new Mocknet()
agent    = await chain.getAgent()
template = await agent.upload(Testing.examples['Echo'].data)
instance = await agent.instantiate(new ContractInstance(template).define({ label: 'test', initMsg: { fail: false } }))
client   = Object.assign(instance.getClientSync(), { agent })

assert.equal(await client.query("echo"), 'echo')
assert.equal(await chain.getLabel(instance.address),   instance.label)
assert.equal(await chain.getHash(instance.address),    instance.codeHash)
assert.equal(await chain.getCodeId(instance.codeHash), instance.codeId)
```

Contract can use to platform APIs as provided by Mocknet:

```typescript
agent    = await new Mocknet().getAgent()
template = await agent.upload(Testing.examples['KV'].data)
instance = await agent.instantiate(new ContractInstance(template).define({ label: 'test', initMsg: { value: "foo" } }))
client   = Object.assign(instance.getClientSync(), { agent })

assert.equal(await client.query("get"), "foo")
assert.ok(await client.execute({"set": "bar"}))
assert.equal(await client.query("get"), "bar")
```

### Mock of mocknet environment

When testing your own contracts with Fadroma Mocknet, you are responsible
for providing the value of the `env` struct seen by the contracts.
Since here we test the mocknet itself, we use this pre-defined value:

```typescript
import { randomBech32 } from '@hackbg/4mat'
export function mockEnv () {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = randomBech32('mocked')
  const address  = randomBech32('mocked')
  return {
    block:    { height, time, chain_id }
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}
```

### Backend tests

```typescript
import './mocknet-backend.spec.ts.md'
import './mocknet-data.spec.ts.md'
```

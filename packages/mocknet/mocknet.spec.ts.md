# Fadroma Mocknet Specification

The Fadroma Mocknet is a pure Node.js implementation of the API and environment
that Cosmos contracts expect.

Because it does not contain a distributed consensus mechanism,
it allows the interaction of multiple smart contracts to be tested
much faster than with a devnet or testnet.

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Mocknet as Chain

* initialize and provide agent:

```typescript
import { Chain, Agent, Client, Contract, ContractTemplate } from '@fadroma/client'
let chain:     Chain
let agent:     Agent
let template:  Contract
let template2: Contract
let instance:  Contract
let client:    Client
```

```typescript
import { Mocknet } from '.'
chain = new Mocknet()
agent = await chain.getAgent()
ok(agent instanceof Mocknet.Agent)
```

* upload WASM blob, returning code ID:

```typescript
import { pathToFileURL } from 'url'
chain     = new Mocknet()
agent     = await chain.getAgent()
template  = await agent.upload(Testing.examples['Echo'].data)
template2 = await agent.upload(Testing.examples['KV'].data)

//equal(template.chainId,  agent.chain.id)
//equal(template2.chainId, template.chainId)
equal(template2.codeId,  String(Number(template.codeId) + 1))
```

* instantiate and call a contract

```typescript
agent    = await new Mocknet().getAgent()
template = { chainId: 'Mocknet', codeId: '2' }
assert.rejects(agent.instantiate(template, 'test', {}))
```

* instantiate and call a contract, successfully this time

```typescript
agent    = await new Mocknet().getAgent()
template = await agent.upload(Testing.examples['Echo'].data)
instance = await agent.instantiate(template.instance({ label: 'test', initMsg: { fail: false } }))
client   = instance.getClientSync()
client.agent = agent
equal(await client.query("echo"), 'echo')
console.debug(await client.execute("echo"), { data: "echo" })
```

* contract can use to platform APIs as provided by Mocknet

```typescript
agent    = await new Mocknet().getAgent()
template = await agent.upload(Testing.examples['KV'].data)
instance = await agent.instantiate(template.instance({ label: 'test', initMsg: { value: "foo" } }))
client   = instance.getClientSync()
client.agent = agent
console.log({ instance, client })
equal(await client.query("get"), "foo")
console.debug(await client.execute({set: "bar"}))
equal(await client.query("get"), "bar")
console.debug(await client.execute("del"))
assert.rejects(client.query("get"))
```

### Mock of mocknet environment

When testing your own contracts with Fadroma Mocknet, you are responsible
for providing the value of the `env` struct seen by the contracts.
Since here we test the mocknet itself, we use this pre-defined value:

```typescript
import { randomBech32 } from '@hackbg/formati'
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

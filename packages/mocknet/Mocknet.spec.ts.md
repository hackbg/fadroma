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
# Fadroma Mocknet Backend

```typescript
import assert from 'node:assert'
import * as Testing from '../../TESTING.ts.md'
```

```typescript
import { MocknetBackend, MocknetContract } from './mocknet-backend'
import { b64toUtf8, utf8toB64 } from './mocknet-data'
let backend:  MocknetBackend
let contract: MocknetContract
let response: { Ok: any, Err: any }
```

* The **`MocknetContract`** class wraps WASM contract blobs and takes care of the CosmWasm
  calling convention.
  * Normally, it isn't used directly - `Mocknet`/`Mocknet.Agent` call
    `MocknetBackend` which calls this.
* Every method has a slightly different shape: Assuming **Handle** is the "standard":
  * **Init** is like Handle but has only 1 variant and response has no `data` attribute.
  * **Query** is like Handle but returns raw base64 and ignores `env`.
  * Every method returns the same thing - a JSON string of the form `{ "Ok": ... } | { "Err": ... }`
    * This corresponds to the **StdResult** struct returned from the contract
    * This result is returned to the contract's containing `MocknetBackend` as-is.

```typescript
let key:   string
let value: string
let data:  string

contract = await new MocknetBackend.Contract().load(Testing.examples['Echo'].data)
response = contract.init(Testing.mockEnv(), { fail: false })
key      = "Echo"
value    = utf8toB64(JSON.stringify({ fail: false }))
assert.deepEqual(response.Err, undefined)
assert.deepEqual(response.Ok,  { messages: [], log: [{ encrypted: true, key, value }] })

response = contract.init(Testing.mockEnv(), { fail: true }))
assert.deepEqual(response.Ok,  undefined)
assert.deepEqual(response.Err, { generic_err: { msg: 'caller requested the init to fail' } })

response = contract.handle(Testing.mockEnv(), "echo")
data     = utf8toB64(JSON.stringify("echo"))
assert.deepEqual(response.Err, undefined)
assert.deepEqual(response.Ok,  { messages: [], log: [], data })

response = contract.handle(Testing.mockEnv(), "fail")
assert.deepEqual(response.Ok,  undefined)
assert.deepEqual(response.Err, { generic_err:  { msg: 'this transaction always fails' } })

response = await contract.query("echo")
assert.deepEqual(response.Err, undefined)
assert.deepEqual(response.Ok,  utf8toB64('"echo"'))

response = await contract.query("fail")
assert.deepEqual(response.Ok, undefined)
assert.deepEqual(response.Err, { generic_err: { msg: 'this query always fails' } })
```

### And some more tests...

```typescript
assert.throws(()=>new MocknetBackend().getInstance())

assert.throws(()=>new MocknetBackend().getInstance('foo'))

assert.throws(()=>new MocknetBackend().makeEnv())

assert.rejects(new MocknetBackend().passCallbacks())

assert.ok(new MocknetBackend('mocknet', {
  123: Testing.examples['Echo'].data
}, {
  'someaddr': await new MocknetBackend.Contract().load(Testing.examples['Echo'].data)
}).passCallbacks('sender', [
  {wasm:{instantiate:{msg:utf8toB64('{"fail":false}'), code_id: 123}}},
  {wasm:{execute:    {msg:utf8toB64('"echo"'), contract_addr: 'someaddr'}}},
  {wasm:{ignored: true}},
  {ignored: true}
]))
```
# Fadroma Mocknet: Data passing

```typescript
import assert from 'assert'
```

## Base64 IO

* **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  responses) are returned by the contract as Base64-encoded strings
  * If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  * These functions are used by the mocknet code to encode/decode the base64.

```typescript
import { b64toUtf8, utf8toB64 } from './mocknet-data'

assert.equal(b64toUtf8('IkVjaG8i'), '"Echo"')
assert.equal(utf8toB64('"Echo"'), 'IkVjaG8i')
```

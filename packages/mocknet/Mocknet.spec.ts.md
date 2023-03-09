# Mocknet: the blockchain that isn't.

If **mainnet** refers to the main instance of a blockchain where all the real activity happens;
a **testnet** is another instance which does not attempt to store value, and is used for testing;
and a **devnet** (or **localnet**) is a local testnet with a single node -- then, what is a
**mocknet**?

Unlike EVM-based chains, which use Ethereum's custom, domain-specific virtual machine, the
smart contract runtime used by CosmWasm-based platforms is based on the industry-standard
WebAssembly platform. This means you can **run real smart contracts without a real blockchain** --
as long as something provides the required APIs for querying state, propagating transactions,
storing data, et cetera.

Thus, the **Fadroma Mocknet** is a pure Node.js mock implementation of the API and environment
that Cosmos contracts expect. Because it does not contain any kind of distributed consensus
mechanism, it allows the business logic of your smart contracts to be tested much faster
than with a real devnet.

## Table of contents

* [Getting started with mocknet](#getting-started-with-mocknet)
* [Testing contracts on mocknet](#testing-contracts-on-mocknet)
* [Implementation details](#implementation-details)

## Getting started with mocknet

You can interact with a mocknet from TypeScript, the same way you interact with any other chain -
through the Fadroma Client API. 

* More specifically, `Mocknet` is an implementation of the `Chain`
  abstract class which represents connection info for chains.
* **NOTE:** Mocknets are currently not persistent.

```typescript
import {
  Mocknet // A temporary local smart contract environment
} from '@fadroma/mocknet'
const mocknet = new Mocknet()
const agent = await mocknet.getAgent()

import { Chain, Agent } from '@fadroma/core'
ok(mocknet instanceof Chain)
ok(agent instanceof Agent)
ok(agent instanceof Mocknet.Agent)
```

When creating a mocknet, the block height starts at 0.
You can increment it manually to represent the passing of block time.

Native token balances also start at 0. You can give native tokens to agents by
setting the `Mocknet#balances` property:

```typescript
equal(mocknet.height, 0)

chain.balances[agent.address] = 1000
assert.equal(await chain.getBalance(agent.address), 1000)

assert.equal(agent.defaultDenom, chain.defaultDenom)
assert.ok(await agent.account)
assert.ok(!await agent.send())
assert.ok(!await agent.sendMany())
```

## Testing contracts on mocknet

Uploading WASM blob will return the expected monotonously incrementing code ID...

```typescript
import { pathToFileURL } from 'url'
const uploaded_a = await agent.upload(Testing.examples['Echo'].data)
const uploaded_b = await agent.upload(Testing.examples['KV'].data)
assert.equal(uploaded_b.codeId,  String(Number(uploaded_a.codeId) + 1))
```

...which you can use to instantiate the contract.

```typescript
const client_a = await agent.instantiate(template_a, {
  label: 'test',
  initMsg: { fail: false }
})

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

## Implementation details

The rest of this executable specification is dedicated to testing and documenting the workings
of the mocknet as implemented by Fadroma.

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

### Base64 IO

* **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  responses) are returned by the contract as Base64-encoded strings
  * If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  * These functions are used by the mocknet code to encode/decode the base64.

```typescript
import { b64toUtf8, utf8toB64 } from './mocknet-data'

assert.equal(b64toUtf8('IkVjaG8i'), '"Echo"')
assert.equal(utf8toB64('"Echo"'), 'IkVjaG8i')
```

```typescript
import assert from 'assert'
import { ok, equal } from 'assert'
import * as Testing from '../../TESTING.ts.md'
```

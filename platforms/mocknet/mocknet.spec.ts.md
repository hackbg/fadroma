# Fadroma Mocknet Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Mocknet as Chain

* initialize and provide agent:

```typescript
import { Chain, Agent, Client, Contract } from '@fadroma/client'
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
client   = await agent.instantiate(template, 'test', { fail: false })
equal(await client.query("echo"), 'echo')
console.debug(await client.execute("echo"), { data: "echo" })
```

* contract can use to platform APIs as provided by Mocknet

```typescript
agent    = await new Mocknet().getAgent()
template = await agent.upload(Testing.examples['KV'].data)
instance = await agent.instantiate(template, 'test', { value: "foo" })
client   = instance.client()
console.log({ instance, client })
equal(await client.query("get"), "foo")
console.debug(await client.execute({set: "bar"}))
equal(await client.query("get"), "bar")
console.debug(await client.execute("del"))
assert.rejects(client.query("get"))
```

## Mocknet backend

```typescript
import { MocknetBackend } from '.'
let contract: MocknetBackend.Contract
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
deepEqual(response.Err, undefined)
deepEqual(response.Ok,  { messages: [], log: [{ encrypted: true, key, value }] })

response = contract.init(Testing.mockEnv(), { fail: true }))
deepEqual(response.Ok,  undefined)
deepEqual(response.Err, { generic_err: { msg: 'caller requested the init to fail' } })

response = contract.handle(Testing.mockEnv(), "echo")
data     = utf8toB64(JSON.stringify("echo"))
deepEqual(response.Err, undefined)
deepEqual(response.Ok,  { messages: [], log: [], data })

response = contract.handle(Testing.mockEnv(), "fail")
deepEqual(response.Ok,  undefined)
deepEqual(response.Err, { generic_err:  { msg: 'this transaction always fails' } })

response = await contract.query("echo")
deepEqual(response.Err, undefined)
deepEqual(response.Ok,  utf8toB64('"echo"'))

response = await contract.query("fail")
deepEqual(response.Ok, undefined)
deepEqual(response.Err, { generic_err: { msg: 'this query always fails' } })
```

## Base64 IO

* **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  responses) are returned by the contract as Base64-encoded strings
  * If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  * These functions are used by the mocknet code to encode/decode the base64.

```typescript
import { b64toUtf8, utf8toB64 } from '.'

equal(b64toUtf8('IkVjaG8i'), '"Echo"')
equal(utf8toB64('"Echo"'), 'IkVjaG8i')
```

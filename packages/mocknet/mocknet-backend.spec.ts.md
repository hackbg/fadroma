# Fadroma Mocknet Backend

```typescript
import assert from 'node:assert'
import * as Testing from '../../TESTING.ts.md'
```

```typescript
import { MocknetBackend, MocknetContract } from './mocknet-backend'
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

## Base64 IO

* **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  responses) are returned by the contract as Base64-encoded strings
  * If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  * These functions are used by the mocknet code to encode/decode the base64.

```typescript
import { b64toUtf8, utf8toB64 } from './mocknet-backend'

assert.equal(b64toUtf8('IkVjaG8i'), '"Echo"')
assert.equal(utf8toB64('"Echo"'), 'IkVjaG8i')
```

## More tests

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

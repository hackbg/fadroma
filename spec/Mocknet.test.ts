import * as assert from 'node:assert'
import { Mocknet } from '@fadroma/agent'
new Mocknet.Console().log('...')
new Mocknet.Console().trace('...')
new Mocknet.Console().debug('...')

// **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
// responses) are returned by the contract as Base64-encoded strings
// If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
// These functions are used by the mocknet code to encode/decode the base64.
assert.equal(Mocknet.Backend.b64toUtf8('IkVjaG8i'), '"Echo"')
assert.equal(Mocknet.Backend.utf8toB64('"Echo"'), 'IkVjaG8i')

let key:   string
let value: string
let data:  string

/*contract = await new MocknetBackend.Contract().load(examples['Echo'].data)
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
assert.deepEqual(response.Err, { generic_err: { msg: 'this query always fails' } })*/
```

### And some more tests...

```typescript
/*
assert.throws(()=>new MocknetBackend().getInstance())

assert.throws(()=>new MocknetBackend().getInstance('foo'))

assert.throws(()=>new MocknetBackend().makeEnv())

assert.rejects(new MocknetBackend().passCallbacks())

assert.ok(new MocknetBackend('mocknet', {
  123: examples['Echo'].data
}, {
  'someaddr': await new MocknetBackend.Contract().load(examples['Echo'].data)
}).passCallbacks('sender', [
  {wasm:{instantiate:{msg:utf8toB64('{"fail":false}'), code_id: 123}}},
  {wasm:{execute:    {msg:utf8toB64('"echo"'), contract_addr: 'someaddr'}}},
  {wasm:{ignored: true}},
  {ignored: true}
]))
*/

import { randomBech32 } from '@fadroma/agent'

export function mockEnv () {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = randomBech32('mocked')
  const address  = randomBech32('mocked')
  return {
    block:    { height, time, chain_id },
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}

# Fadroma Mocknet

The Fadroma Mocknet is a pure JS implementation of the
API and environment that Cosmos smart contracts expect.
It does not contain a distributed consensus mechanism,
which enables smart contract-based programs to be executed in isolation.

```typescript
const MocknetSpec = {}
const test = tests => Object.assign(MocknetSpec, tests)
export default MocknetSpec
```

## Example contracts

Testing of the mocknet is conducted via two minimal smart contracts.
Compiled artifacts of those are stored under [`/fixtures`](../fixtures).
You can recompile them with the Fadroma Build CLI.

```typescript
import { fixture } from './_Harness'
import { readFileSync } from 'fs'
export const ExampleContracts = { Paths: {}, Blobs: {} }
```

### Echo contract

> Compile with `./fadroma.cjs build examples/echo` in repo root.

This parrots back the data sent by the client, in order to validate
reading/writing and serializing/deserializing the input/output messages.

```typescript
ExampleContracts.Paths.Echo = fixture('fixtures/fadroma-example-echo@HEAD.wasm')
ExampleContracts.Blobs.Echo = readFileSync(ExampleContracts.Paths.Echo)
```

## KV contract

> Compile with `./fadroma.cjs build examples/kv` in repo root.

This exposes the key/value storage API available to contracts,
in order to validate reading/writing and serializing/deserializing stored values.

```typescript
ExampleContracts.Paths.KV = fixture('fixtures/fadroma-example-kv@HEAD.wasm')
ExampleContracts.Blobs.KV = readFileSync(ExampleContracts.Paths.KV)
```

## Mocking the environment

When testing your own contracts with Fadroma Mocknet, you are responsible
for providing the value of the `env` struct seen by the contracts.
Since here we test the mocknet itself, we use this pre-defined value:

```typescript
import { randomBech32 } from '@hackbg/toolbox'
const mockEnv = () => {
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

## Tests of public API

### Can initialize and provide agent

```typescript
import { Mocknet, MocknetAgent } from '../index'
test({
  async "Mocknet: can initialize and create MocknetAgent" ({ ok }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    ok(agent instanceof MocknetAgent)
  }
})
```

### Can upload WASM blob, returning code ID

```typescript
import { pathToFileURL } from 'url'
test({
  async 'MocknetAgent: can upload wasm blob, returning code id' ({ equal }) {
    const agent = await new Mocknet().getAgent()
    const artifact = { url: pathToFileURL(ExampleContracts.Paths.Echo) }
    const template = await agent.upload(artifact)
    equal(template.chainId, agent.chain.id)
    const template2 = await agent.upload(artifact)
    equal(template2.chainId, template.chainId)
    equal(template2.codeId, String(Number(template.codeId) + 1))
  }
})
```

### Can instantiate and call a contract

```typescript
import { Client } from '../index'
test({
  async 'MocknetAgent: contract init from missing code ID fails' ({ rejects }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    rejects(agent.instantiate(template, 'test', {}))
  },
  async 'MocknetAgent: contract upload and init' ({ ok, equal }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const artifact = { url: pathToFileURL(ExampleContracts.Paths.Echo), codeHash: 'something' }
    const template = await agent.upload(artifact)
    const message  = { fail: false }
    const instance = await agent.instantiate(template, 'test', message)
    const client   = agent.getClient(Client, instance)
    equal(await client.query("Echo"), '"Echo"')
    ok(await client.execute("Echo"), { data: "Echo" })
  }
})
```

### Contract deployed to mocknet can use simulated platform APIs

```typescript
test({
  async 'MocknetAgent: contract supports db read/write/remove' ({ ok, equal, rejects }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const artifact = { url: pathToFileURL(ExampleContracts.Paths.KV), codeHash: 'something' }
    const template = await agent.upload(artifact)
    const instance = await agent.instantiate(template, 'test', { value: "foo" })
    const client   = agent.getClient(Client, instance)
    equal(await client.query("Get"), "foo")
    ok(await client.execute({Set: "bar"}))
    equal(await client.query("Get"), "bar")
    ok(await client.execute("Del"))
    rejects(client.query("Get"))
  }
})
```

## Tests of internals

### Base64 decoding

Fields that are of type `Binary` (query responses and the `data` field of handle responses)
are returned by the contract as Base64-encoded strings. This function decodes them.

> If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.

```typescript
import { b64toUtf8, utf8toB64 } from '../packages/ops/Mocknet'
test({
  'b64toUtf8' ({ equal }) {
    equal(b64toUtf8('IkVjaG8i'), '"Echo"')
  },
  'utf8toB64' ({ equal }) {
    equal(utf8toB64('"Echo"'), 'IkVjaG8i')
  }
})
```

### MocknetContract

The `MocknetContract` class calls methods on WASM contract blobs.
Normally, it isn't used directly - `Mocknet`/`MocknetAgent` call
`MocknetBackend` which calls this.

* Every method has a slightly different shape:
  * Assuming **Handle** is the "standard":
  * **Init** is like Handle but has only 1 variant and response has no `data` attribute.
  * **Query** is like Handle but returns raw base64 and ignores `env`.
* Every method returns the same thing - a JSON string of the form `{ "Ok": ... } | { "Err": ... }`
  * This corresponds to the **StdResult** struct returned from the contract
  * This result is returned to the contract's containing `MocknetBackend` as-is.

```typescript
import { MocknetContract } from '../index' // wait what
test({

  async "MocknetContract#init -> Ok" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const initMsg     = { fail: false }
    const { Ok, Err } = contract.init(mockEnv(), initMsg)
    const key         = "Echo"
    const value       = utf8toB64(JSON.stringify(initMsg))
    equal(Err, undefined)
    deepEqual(Ok, { messages: [], log: [{ encrypted: false, key, value }] })
  },

  async "MocknetContract#init -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.init(mockEnv(), { fail: true })
    equal(Ok, undefined)
    deepEqual(Err, { generic_err: { msg: 'caller requested the init to fail' } })
  },

  async "MocknetContract#handle -> Ok" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.handle(mockEnv(), "Echo")
    const data        = utf8toB64(JSON.stringify("Echo"))
    equal(Err, undefined)
    deepEqual(Ok, { messages: [], log: [], data })
  },

  async "MocknetContract#handle -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = contract.handle(mockEnv(), "Fail")
    equal(Ok, undefined)
    deepEqual(Err, { generic_err:  { msg: 'this transaction always fails' } })
  },

  async "MocknetContract#query -> Ok" ({ equal }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = await contract.query("Echo")
    equal(Err, undefined)
    equal(Ok,  utf8toB64('"Echo"'))
  },

  async "MocknetContract#query -> Err" ({ equal, deepEqual }) {
    const contract    = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const { Ok, Err } = await contract.query("Fail")
    equal(Ok, undefined)
    deepEqual(Err, { generic_err: { msg: 'this query always fails' } })
  }

})
```

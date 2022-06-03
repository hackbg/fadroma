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
import { Mocknet, MockAgent } from '../index'
test({
  async "can initialize and create agent" ({ ok }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    ok(agent instanceof MockAgent)
  }
})
```

### Can upload WASM blob, returning code ID

```typescript
import { pathToFileURL } from 'url'
test({
  async 'can upload wasm blob, returning code id' ({ equal }) {
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
  async 'init from missing code ID' ({ rejects }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    rejects(agent.instantiate(template, 'test', {}))
  },
  async 'upload and init from resulting code ID' ({ ok, equal }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const artifact = { url: pathToFileURL(ExampleContracts.Paths.Echo), codeHash: 'something' }
    const template = await agent.upload(artifact)
    const instance = await agent.instantiate(template, 'test', {})
    const client   = agent.getClient(Client, instance)
    equal(await client.query("Echo"), "Echo")
    ok(await client.execute("Echo"), { data: "Echo" })
  }
})
```

### Contract deployed to mocknet can use simulated platform APIs

```typescript
test({
  async 'db read/write/remove' ({ ok, equal, rejects }) {
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

### The `MocknetContract` class can call methods on WASM contract blobs

```typescript
import { MocknetContract } from '../index' // wait what
test({
  async "MocknetContract#init" ({ equal, deepEqual }) {
    const contract = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const initMsg  = { echo: "Echo" }
    const result   = contract.init(mockEnv(), initMsg)
    const value    = Buffer.from(JSON.stringify(initMsg), 'utf8').toString('base64')
    equal(result.Err,             undefined)
    deepEqual(result.Ok.messages, [])
    deepEqual(result.Ok.log,      [{ encrypted: false, key: 'Echo', value }])
  }
  async "MocknetContract#handle" ({ equal, deepEqual }) {
    const contract = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const result   = contract.handle(mockEnv(), "Echo")
    equal(result.Err,             undefined)
    deepEqual(result.Ok.messages, [])
    deepEqual(result.Ok.log,      [])
    deepEqual(result.Ok.data,     "Echo")
  }
  async "MocknetContract#query" ({ equal }) {
    const contract = await new MocknetContract().load(ExampleContracts.Blobs.Echo)
    const result   = await contract.query("Echo")
    equal(result.Err,             undefined)
    equal(result.Ok,              "Echo")
  }
})
```

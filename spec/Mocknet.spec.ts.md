# Fadroma Guide: Mocknet

Testing the production builds of smart contracts can be slow and awkward.
Testnets are permanent and public; devnets can be temporary, but transactions
are still throttled by the block rate.

Mocknet is a lightweight functioning mock of a CosmWasm-capable
platform, structured as an implementation of the Fadroma Chain API.
It emulates the APIs that a CosmWasm contract expects to see when
running in production, on top of the JavaScript engine's built-in
WebAssembly runtime.

This way, you can run your real smart contracts without a real blockchain,
and quickly test their user-facing functionality and interoperation
in a customizable environment.

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
import { Mocknet } from '@fadroma/agent'
let chain = new Mocknet.Chain()
let agent = await chain.getAgent()

import { Chain, Agent, Mocknet } from '@fadroma/agent'
assert.ok(chain instanceof Chain)
assert.ok(agent instanceof Agent)
assert.ok(agent instanceof Mocknet.Agent)
```

When creating a mocknet, the block height starts at 0.
You can increment it manually to represent the passing of block time.

Native token balances also start at 0. You can give native tokens to agents by
setting the `Mocknet#balances` property:

```typescript
assert.equal(await chain.height, 0)

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
import { examples } from '../fixtures/Fixtures.ts.md'

assert.equal(chain.lastCodeId, 0)

const uploaded_a = await agent.upload(examples['KV'].data.load(), examples['KV'])
assert.equal(uploaded_a.codeId, 1)
assert.equal(chain.lastCodeId, 1)

const uploaded_b = await agent.upload(examples['Legacy'].data.load(), examples['Legacy'])
assert.equal(uploaded_b.codeId, 2)
assert.equal(chain.lastCodeId, 2)
```

...which you can use to instantiate the contract.

```typescript
const contract_a = uploaded_a.instance({ agent, name: 'kv', initMsg: { fail: false } })
const client_a = await contract_a.deployed

const contract_b = uploaded_b.instance({ agent, name: 'legacy', initMsg: { fail: false } })
const client_b = await contract_b.deployed

assert.deepEqual(
  await client_a.query({get: {key: "foo"}}),
  [null, null] // value returned from the contract
)

assert.ok(await client_a.execute({set: {key: "foo", value: "bar"}}))

const [data, meta] = await client_a.query({get: {key: "foo"} })
assert.equal(data, 'bar')
assert.ok(meta)

await chain.getLabel(client_a.address)
await chain.getHash(client_a.address)
await chain.getCodeId(client_a.codeHash)
```

## Backwards compatibility

Mocknet supports contracts compiled for CosmWasm 0.x or 1.x.

```typescript
assert.equal(chain.contracts[contract_a.address].cwVersion, '1.x')
assert.equal(chain.contracts[contract_b.address].cwVersion, '0.x')
```

## Snapshots

Currently, **Mocknet is not stateful:** it only exists for the duration of the script run.

You can instantiate Mocknet with pre-uploaded contracts:

```typescript
chain = new Mocknet.Chain({
  uploads: {
    1:   new Uint8Array(),
    234: new Uint8Array()
    567: new Uint8Array()
  }
})

assert.equal(chain.lastCodeId, 567)
```

---

```typescript
import assert from 'node:assert'
```

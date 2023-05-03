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
let chain = new Mocknet.CW1()
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
const uploaded_a = await agent.upload(examples['KV'].data.load())
const uploaded_b = await agent.upload(examples['KV'].data.load())
assert.equal(uploaded_b.codeId, String(Number(uploaded_a.codeId) + 1))
```

...which you can use to instantiate the contract.

```typescript
const contract_a = uploaded_a.instance({ agent, name: 'test-mocknet', initMsg: { fail: false } })
const client_a = await contract_a.deployed

assert.deepEqual(await client_a.query({get: {key: "foo"}}), [null, null])
//assert.equal(await chain.getLabel(client_a.address),   client_a.label)
//assert.equal(await chain.getHash(client_a.address),    client_a.codeHash)
//assert.equal(await chain.getCodeId(client_a.codeHash), client_a.codeId)
```

Contract can use platform APIs as provided by Mocknet:

```typescript
//agent    = await chain.getAgent()
//template = await agent.upload(examples['KV'].data)
//instance = await agent.instantiate(new ContractInstance(template).define({ label: 'test', initMsg: { value: "foo" } }))
//client   = Object.assign(instance.getClientSync(), { agent })

//assert.equal(await client.query("get"), "foo")
//assert.ok(await client.execute({"set": "bar"}))
//assert.equal(await client.query("get"), "bar")
```

---

```typescript
import assert from 'node:assert'
```

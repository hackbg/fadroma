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

## Can run WASM blob

```typescript
import { readFileSync } from 'fs'
import { Contract } from '../index'
import { fixture } from './_Harness'
const emptyContract     = fixture('examples/empty-contract/artifacts/empty@HEAD.wasm')
const emptyContractWasm = readFileSync(emptyContract)
const mockEnv = () => {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = "secret1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  const address  = "secret1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  return {
    block:    { height, time, chain_id }
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}
test({
  async "Contract#init" ({ equal }) {
    const contract = await new Contract().load(emptyContractWasm)
    const result = contract.init(mockEnv(), {})
    equal(result.Err, undefined)
  }
  async "Contract#handle" ({ equal }) {
    const contract = await new Contract().load(emptyContractWasm)
    const result = contract.handle(mockEnv(), "Null")
    equal(result.Err, undefined)
  }
  async "Contract#query" ({ equal }) {
    const contract = await new Contract().load(emptyContractWasm)
    const result = await contract.query("Echo")
    equal(result.Err, undefined)
  }
})
```

## Can initialize and provide agent

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

## Can upload WASM blob, returning code ID

```typescript
import { pathToFileURL } from 'url'
test({
  async 'can upload wasm blob, returning code id' ({ equal }) {
    const agent = await new Mocknet().getAgent()
    const artifact = { url: pathToFileURL(emptyContract) }
    const template = await agent.upload(artifact)
    equal(template.chainId, agent.chain.id)
    const template2 = await agent.upload(artifact)
    equal(template2.chainId, template.chainId)
    equal(template2.codeId, String(Number(template.codeId) + 1))
  }
})
```

## Can instantiate and call a contract

```typescript
import { Client } from '../index'
test({
  async 'init from missing code ID' ({ rejects }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    rejects(agent.instantiate(template, 'test', {}))
  },
  async 'upload and init from resulting code ID' ({ ok }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const artifact = { url: pathToFileURL(emptyContract), codeHash: 'something' }
    const template = await agent.upload(artifact)
    const instance = await agent.instantiate(template, 'test', {})
    const client   = agent.getClient(Client, instance)
    ok(await client.query({}))
    ok(await client.execute({}))
  }
})
```

## Contract deployed to mocknet can use simulated platform APIs

```typescript
const storageContract     = fixture('examples/empty-contract/artifacts/empty@HEAD.wasm')
const storageContractWasm = readFileSync(emptyContract)
test({
  async 'db read/write/remove' ({ ok, equal, rejects }) {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const artifact = { url: pathToFileURL(emptyContract), codeHash: 'something' }
    const template = await agent.upload(artifact)
    const instance = await agent.instantiate(template, 'test', { value: "foo" })
    const client   = agent.getClient(Client, instance)
    equal(await client.query("get"), "foo")
    ok(await client.execute({set: "bar"}))
    equal(await client.query("get"), "bar")
    ok(await client.execute("del"))
    rejects(client.query("get"))
  }
})
```

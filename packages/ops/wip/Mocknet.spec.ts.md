# Fadroma Mocknet

```typescript
import assert from 'assert'
const MocknetSpec = {}
const test = tests => Object.assign(MocknetSpec, tests)
export default MocknetSpec
```

## Can run WASM blob

```typescript
import { resolve, dirname, fileURLToPath, readFileSync } from '@hackbg/toolbox'
import { Contract } from './Mocknet'
const fixture           = x => resolve(dirname(fileURLToPath(import.meta.url)), '../../..', x)
const emptyContract     = fixture('examples/empty-contract/artifacts/empty@HEAD.wasm')
const emptyContractWasm = readFileSync(emptyContract)
const mockEnv = () => ({
  block: {
    height:   0,
    time:     0,
    chain_id: "mock"
  },
  message: {
    sender:  "secret1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    sent_funds: []
  },
  contract: {
    address: "secret1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  contract_key: "",
  contract_code_hash: ""
})
test({
  async "Contract#init" ({ equal }) {
    const contract = await Contract.load(emptyContractWasm)
    const result = contract.init(mockEnv(), {})
    equal(result.Err, undefined)
  }
  async "Contract#handle" ({ equal }) {
    const contract = await Contract.load(emptyContractWasm)
    const result = contract.handle(mockEnv(), "Null")
    equal(result.Err, undefined)
  }
  async "Contract#query" ({ equal }) {
    const contract = await Contract.load(emptyContractWasm)
    const result = await contract.query("Echo")
    equal(result.Err, undefined)
  }
})
```

## Can initialize and provide agent

```typescript
import { Mocknet, MockAgent } from './Mocknet'
test({
  async "can initialize and create agent" () {
    const chain = new Mocknet()
    const agent = await chain.getAgent({})
    assert(agent instanceof MockAgent)
  }
})
```

## Can upload WASM blob, returning code ID

```typescript
test({
  async 'can upload wasm blob, returning code id' () {
    const agent = await new Mocknet().getAgent()
    const artifact = { location: emptyContract }
    const template = await agent.upload(artifact)
    assert(template.chainId === agent.chain.id)
    const template2 = await agent.upload(artifact)
    assert(template2.chainId === template.chainId)
    assert(template2.codeId === String(Number(template.codeId) + 1))
  }
})
```

## Can instantiate code ID, returning contract address

```typescript
test({
  async 'upload and init from resulting code ID' () {
    const chain    = new Mocknet()
    const agent    = await chain.getAgent()
    const template = await agent.upload({ location: emptyContract, codeHash: 'something' })
    const instance = await agent.instantiate(template, 'test', {})
  }
  async 'init from missing code ID' ({ rejects }) {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    rejects(agent.instantiate(template, 'test', {}))
  }
})
```

## Can query and transact with contract

```typescript
import { Client } from '../Client'
test({
  async 'can query' () {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const client = new Client({agent})
    await client.query({})
  },
  async 'can transact' () {
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const client = new Client({agent})
    await client.execute({})
  }
})
```

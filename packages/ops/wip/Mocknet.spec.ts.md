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
import { runInit, runHandle, runQuery } from './Mocknet'
const fixture = x => resolve(dirname(fileURLToPath(import.meta.url)), '../../../fixtures', x)
const contract = readFileSync(fixture('empty@HEAD.wasm'))
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
  async "runInit" () {
    const result = await runInit({}, contract, mockEnv(), {})
    console.log(JSON.stringify(result))
  }
  async "runHandle" () {
    const result = await runHandle({}, contract, mockEnv(), "null")
    console.log(result)
  }
  async "runQuery" () {
    const result = await runQuery({}, contract, "echo")
    console.log(result)
  }
})
```

## Can initialize and provide agent

```typescript
import { Mocknet, MockAgent } from './Mocknet'
test({
  async "can initialize and create agent" () {
    throw 'TODO'
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
    throw 'TODO'
    const agent = await new Mocknet().getAgent()
    const artifact = { location: fixture('token.wasm') }
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
  async 'init from valid code ID' () {
    throw 'TODO'
    const agent = await new Mocknet().getAgent()
    const instance = await agent.instantiate(
      await agent.upload({ location: fixture('token.wasm') }),
      'test',
      {}
    )
  }
  async 'init from missing code ID' () {
    throw 'TODO'
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const template = { chainId: 'Mocknet', codeId: '2' }
    const error = await agent.instantiate(template, 'test', {}).catch(e=>e)
    assert(error instanceof Error)
  }
})
```

## Can query and transact with contract

```typescript
import { Client } from '../Client'
test({
  async 'can query' () {
    throw 'TODO'
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const client = new Client({agent})
    await client.query({})
  },
  async 'can transact' () {
    throw 'TODO'
    const chain = new Mocknet()
    const agent = await chain.getAgent()
    const client = new Client({agent})
    await client.execute({})
  }
})
```

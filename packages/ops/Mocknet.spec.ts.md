# Fadroma Mocknet

```typescript
import assert from 'assert'
const MocknetSpec = {}
const test = tests => Object.assign(MocknetSpec, tests)
export default MocknetSpec
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
import { resolve, dirname, fileURLToPath } from '@hackbg/tools'
const __dirname = dirname(fileURLToPath(import.meta.url)
test({
  async 'can upload wasm blob, returning code id' () {
    const agent = await new Mocknet().getAgent()
    const artifact = { location: resolve(__dirname, '.fixtures/null.wasm') }
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
    const agent = await new Mocknet().getAgent()
    const instance = await agent.instantiate(
      await agent.upload({ location: resolve(__dirname, '.fixtures/null.wasm') }),
      'test',
      {}
    )
  }
  async 'init from missing code ID' () {
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
import { Client } from './Client'
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

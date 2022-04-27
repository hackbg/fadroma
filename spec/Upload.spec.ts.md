# Fadroma Upload

```typescript
const UploadSpec = {}
const test = tests => Object.assign(UploadSpec, tests)
export default UploadSpec
```

## Basic uploader

```typescript
import { FSUploader } from '../index'
import { fixture } from './_Harness'
const emptyContract = fixture('examples/empty-contract/artifacts/empty@HEAD.wasm')
test({
  'construct FSUploader' ({ ok }) {
    const agent = Symbol()
    const uploader = new FSUploader(agent)
    ok(uploader.agent === agent)
  },
  async 'FSUploader#upload' ({ deepEqual }) {
    const artifact        = { location: emptyContract }
    const codeId          = Symbol()
    const codeHash        = Symbol()
    const transactionHash = Symbol()
    const template = { codeId, codeHash, transactionHash }
    const agent = {
      chain:     { id: Symbol() },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
    const result   = await uploader.upload(artifact)
    deepEqual(result, {
      chainId: agent.chain.id,
      codeId, codeHash, transactionHash
    })
  },
  async 'FSUploader#uploadMany' ({ deepEqual }) {
    const artifact = Symbol()
    const template = Symbol()
    const agent = {
      chain:     { id: Symbol() },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
    deepEqual(await uploader.uploadMany([
      null,
      artifact,
      undefined,
      artifact,
      artifact,
      false
    ]), [
      undefined,
      template,
      undefined,
      template,
      template,
      undefined,
    ])
  }
})
```

## Caching

```typescript
import { CachingFSUploader, withTmpFile } from '../index'

const mockAgent = () => ({
  async upload () { return {} }
  chain: {
    uploads: {
      resolve: () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      make: () => ({
        resolve: () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      })
    }
  },
})

test({
  'add CachingFSUploader to migration context' ({ ok }) {
    const agent = { chain: { uploads: Symbol() } }
    const uploader = new CachingFSUploader(agent)
    ok(uploader.agent === agent)
  },
  async 'upload 1 artifact with CachingFSUploader#upload' ({ ok }) {
    const agent = mockAgent()
    const uploader = new CachingFSUploader(agent)
    await withTmpFile(async location=>{
      const artifact = { location }
      ok(await uploader.upload(artifact))
    })
  },
  async 'upload any number of artifacts with CachingFSUploader#uploadMany' ({ ok }) {
    const agent = mockAgent()
    const uploader = new CachingFSUploader(agent)
    ok(await uploader.uploadMany())
    ok(await uploader.uploadMany([]))
    await withTmpFile(async location=>{
      ok(await uploader.uploadMany([{location}]))
      ok(await uploader.uploadMany([{location}, {location}]))
    })
  },
})
```

## Upload receipts directory

```typescript
import { Uploads } from '../index'
```

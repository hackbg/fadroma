# Fadroma Upload

```typescript
import assert from 'assert'
const UploadSpec = {}
const test = tests => Object.assign(UploadSpec, tests)
export default UploadSpec
```

## Basic uploader

```typescript
import { FSUploader } from './Upload'
test({
  'FSUploader.enable' (assert) {
    const agent = Symbol()
    const { uploader } = FSUploader.enable({ agent })
    assert(uploader.agent === agent)
  },
  async 'FSUploader#upload' (assert) {
    const artifact        = Symbol()
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
    assert.deepEqual(result, {
      chainId: agent.chain.id,
      codeId, codeHash, transactionHash
    })
  },
  async 'FSUploader#uploadMany' (assert) {
    const artifact = Symbol()
    const template = Symbol()
    const agent = {
      chain:     { id: Symbol() },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
    assert.deepEqual(await uploader.uploadMany([
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
import { CachingFSUploader } from './Upload.ts.md'
```

## Upload receipts directory

```typescript
import { Uploads } from './Upload.ts.md'
```

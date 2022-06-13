# Fadroma Upload

```typescript
const UploadSpec = {}
const test = tests => Object.assign(UploadSpec, tests)
export default UploadSpec
```

## Basic uploader

```typescript
import { pathToFileURL } from 'url'
const emptyContract = pathToFileURL(fixture('examples/empty-contract/artifacts/empty@HEAD.wasm'))

import { FSUploader } from '../index'
import { fixture } from './_Harness'
test({
  'construct FSUploader' ({ ok }) {
    const agent = Symbol()
    const uploader = new FSUploader(agent)
    ok(uploader.agent === agent)
  },
  async 'FSUploader#upload' ({ deepEqual }) {
    const artifact        = { url: emptyContract }
    const chainId         = Symbol()
    const codeId          = Symbol()
    const codeHash        = Symbol()
    const transactionHash = Symbol()
    const template = { chainId, codeId, codeHash, transactionHash }
    const agent = {
      chain:     { id: chainId },
      upload:    async (artifact) => template,
      nextBlock: Promise.resolve()
    }
    const uploader = new FSUploader(agent)
    const result   = await uploader.upload(artifact)
    deepEqual(result, template)
  },
  async 'FSUploader#uploadMany' ({ deepEqual }) {
    const artifact = { url: emptyContract }
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
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { CachingFSUploader } from '../index'
import { resolve } from 'path'

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
  'add CachingFSUploader to operation context' ({ ok }) {
    const agent = { chain: { uploads: Symbol() } }
    const cache = Symbol()
    const uploader = new CachingFSUploader(agent, cache)
    ok(uploader.agent === agent)
  },
  async 'upload 1 artifact with CachingFSUploader#upload' ({ ok }) {
    await withTmpDir(async cacheDir=>{
      const agent = mockAgent()
      const cache = new Path(cacheDir).in('uploads').as(JSONDirectory)
      const uploader = new CachingFSUploader(agent, cache)
      await withTmpFile(async location=>{
        const url = pathToFileURL(location)
        ok(await uploader.upload({url}))
      })
    })
  },
  async 'upload any number of artifacts with CachingFSUploader#uploadMany' ({ ok }) {
    await withTmpDir(async cacheDir=>{
      const agent = mockAgent()
      const cache = new Path(cacheDir).in('uploads').as(JSONDirectory)
      const uploader = new CachingFSUploader(agent, cache)
      ok(await uploader.uploadMany())
      ok(await uploader.uploadMany([]))
      await withTmpFile(async location=>{
        const url = pathToFileURL(location)
        ok(await uploader.uploadMany([{url}]))
        ok(await uploader.uploadMany([{url}, {url}]))
      })
    })
  },
})
```

## Upload receipts directory

```typescript
import { Uploads } from '../index'
```

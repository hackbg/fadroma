# Fadroma Upload Specification

```typescript
import { ok } from 'node:assert'
```

```typescript
import { DeployConfig } from '@fadroma/deploy'
import { Agent, Uploader, ContractTemplate } from '@fadroma/client'
let config:   DeployConfig
let uploader: Uploader
let agent:    Agent
let template: ContractTemplate
```

The abstract base class `Uploader` defined in Fadroma Core is here extended
to implement the `FSUploader` class.

  * It uploads compiled contracts to the chain.
    * It needs an `agent` to perform the upload.

```typescript
config = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' })
uploader = await config.getUploader()
ok(uploader instanceof Uploader)
```

  * It writes **upload receipts** to a specified directory,
    and uses those every subsequent time you request the same contract
    to be uploaded.

```typescript
import { Agent, Contract, Uploader } from '@fadroma/client'
import { FSUploader } from '.'
agent = Testing.mockAgent()
uploader  = new FSUploader(agent, new JSONDirectory())
ok(uploader.agent === agent)
await uploader.upload(new Contract({ artifact }))
await uploader.uploadMany([])

const testUpload = async (cb) => {
  const { template, uploader, uploaded } = await cb()
  ok(uploaded !== template)
  ok(uploaded.artifact?.toString() === template.artifact.toString())
  //ok(uploaded.uploader === uploader)
}

await testUpload(async () => {
  const template = new Contract({ artifact })
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Contract({ artifact })
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Contract({ artifact, uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Contract({ artifact }, { uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})
```

* Caching uploader

```typescript
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { Uploads } from '.'
import { resolve } from 'path'

// 'add FSUploader to operation context' ({ ok }) {

// async 'upload 1 artifact with FSUploader#upload' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = Testing.mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new FSUploader(agent, cache)
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.upload(new Contract({artifact})))
  })
})

// async 'upload any number of artifacts with FSUploader#uploadMany' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = Testing.mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new FSUploader(agent, cache)
  ok(await uploader.uploadMany())
  ok(await uploader.uploadMany([]))
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.uploadMany([Testing.examples['KV']]))
    ok(await uploader.uploadMany([Testing.examples['KV'], Testing.examples['Echo']]))
  })
})
```

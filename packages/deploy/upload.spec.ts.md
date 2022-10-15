## `FSUploader`: uploading local files

```typescript
import { Agent, Contract, Uploader } from '@fadroma/client'
import { FSUploader } from '.'
let agent:    Agent    = Testing.mockAgent()
let template: Contract = null
let uploader: Uploader
uploader = new FSUploader(agent, new JSONDirectory())
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

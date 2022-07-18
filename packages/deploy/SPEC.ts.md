# Fadroma Deploy Spec

## Upload

```typescript
import { Uploader, FSUploader, CachingFSUploader } from '.'
let uploader: Uploader
```

* Basic uploader

```typescript
import { pathToFileURL } from 'url'
let chainId, codeId, codeHash, txHash, template, result

const emptyContract = pathToFileURL(Testing.fixture('empty.wasm'))

chainId  = 'test-uploads'
agent    = { chain: { id: chainId }, upload: async (artifact) => template, nextBlock: Promise.resolve() }
uploader = new FSUploader(agent)
artifact = { url: emptyContract }
chainId  = Symbol()
codeId   = Symbol()
codeHash = Symbol()
txHash   = Symbol()
template = { chainId, codeId, codeHash, transactionHash: txHash }
result   = await uploader.upload(artifact)
deepEqual(result, template)
ok(uploader.agent === agent)

artifact = { url: emptyContract }
template = Symbol()
agent    = { chain: { id: Symbol() }, upload: async (artifact) => template, nextBlock: Promise.resolve() }
uploader = new FSUploader(agent)
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
```

* Caching uploader

```typescript
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { CachingFSUploader, Uploads } from '.'
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
  instantiate ({ codeId }, label, msg) {
    return { codeId, label }
  },
  instantiateMany (configs, prefix) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      if (prefix) label = `${prefix}/${label}`
      receipts[name] = { codeId, label }
    }
    return receipts
  }
})

// 'add CachingFSUploader to operation context' ({ ok }) {
agent = { chain: { uploads: Symbol() } }
const cache = Symbol()
uploader = new CachingFSUploader(agent, cache)
ok(uploader.agent === agent)

// async 'upload 1 artifact with CachingFSUploader#upload' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new CachingFSUploader(agent, cache)
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.upload({url}))
  })
})

// async 'upload any number of artifacts with CachingFSUploader#uploadMany' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new CachingFSUploader(agent, cache)
  ok(await uploader.uploadMany())
  ok(await uploader.uploadMany([]))
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.uploadMany([Testing.examples['KV']]))
    ok(await uploader.uploadMany([Testing.examples['KV'], Testing.examples['Echo']]))
  })
})
```

## Deploy

```typescript
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { Deployment } from '.'

// save/load deployment data
await withTmpFile(f=>{
  const d = new Deployment(f)
  equal(d.prefix, basename(f))
  deepEqual(d.receipts, {})
  equal(d, d.save('test', JSON.stringify({ foo: 1 }))
  equal(d, d.add('test1', { test1: 1 }))
  ok(!d.load())
  equal(d, d.set('test2', { test2: 2 }))
  equal(d, d.setMany({test3: 3, test4: 4}))
  assert.throws(()=>d.get('missing'))
})

// init contract from uploaded template
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const codeId     = 0
  const template   = { codeId }
  const initMsg    = Symbol()
  const name       = 'contract'
  const label      = `${basename(f)}/${name}`
  deepEqual(await deployment.init(agent, template, name, initMsg), { codeId, label })
  deepEqual(deployment.get(name), { name, codeId, label })
})

// init many contracts from the same template
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const codeId     = 1
  const template   = { codeId }
  const initMsg    = Symbol()
  const configs    = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts   = await deployment.initMany(agent, template, configs)
  deepEqual(receipts, [
    { codeId, label: `${basename(f)}/contract1` },
    { codeId, label: `${basename(f)}/contract2` },
  ])
  deepEqual(deployment.get('contract1'), {
    name: 'contract1',
    label: `${basename(f)}/contract1`,
    codeId,
  })
  deepEqual(deployment.get('contract2'), {
    name: 'contract2',
    label: `${basename(f)}/contract2`,
    codeId,
  })
})

// init many contracts from different templates
await withTmpFile(async f=>{
  const agent      = mockAgent()
  const deployment = new Deployment(f)
  const templateA  = { codeId: 2 }
  const templateB  = { codeId: 3 }
  const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
  const receipts   = await deployment.initVarious(agent, configs)
  deepEqual(receipts, [
    { codeId: 2, label: `${basename(f)}/contractA`, },
    { codeId: 3, label: `${basename(f)}/contractB`, },
  ])
  deepEqual(deployment.get('contractA'), {
    name: 'contractA',
    label: `${basename(f)}/contractA`,
    codeId: 2
  })
  deepEqual(deployment.get('contractB'), {
    name: 'contractB',
    label: `${basename(f)}/contractB`,
    codeId: 3
  })
})
```

### Deployments directory

```typescript
import { Deployments, Deploy } from '.'
import { withTmpDir } from '@hackbg/kabinet'
import { existsSync } from 'fs'

// deployments
await withTmpDir(async dir=>{
  const deployments = new Deployments(dir)
  await deployments.create('test-deployment-1')
  await deployments.create('test-deployment-2')
  await deployments.select('test-deployment-1')
  await deployments.select('test-deployment-2')
  assert(deployments.active instanceof Deployment)
  deployments.get()
  deployments.list()
  deployments.save('test', 'test')
})
```


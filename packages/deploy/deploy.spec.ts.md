# Fadroma Deploy Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

```typescript
import * as Fadroma from '@fadroma/client'
let chain:    Fadroma.Chain    = null
let agent:    Fadroma.Agent    = null
let template: Fadroma.Template = null
let artifact: Fadroma.URL      = null
let chainId, codeId, codeHash, txHash, result
```

## Upload

```typescript
import * as Upload from '.'
let uploader: Upload.Uploader
```

* Basic uploader

```typescript
import { pathToFileURL } from 'url'
uploader = new Upload.FSUploader(agent)

const testUpload = async (cb) => {
  const { template, uploader, uploaded } = await cb()
  ok(uploaded !== template)
  ok(uploaded.artifact === template.artifact)
  ok(uploaded.uploader === uploader)
}

chain    = { id: chainId }
agent    = { chain, upload: async (artifact) => template, nextBlock: Promise.resolve() }
artifact = pathToFileURL(Testing.fixture('empty.wasm'))

await testUpload(async () => {
  const template = new Fadroma.Template(artifact)
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Template({ artifact })
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Template(artifact)
  const uploaded = await template.upload(uploader)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Template(artifact, { uploader })
  const uploaded = await template.upload(uploader)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Template({ artifact, uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Template({ artifact }, { uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})

chainId  = 'test-uploads'
artifact = { url: emptyContract }
template = { chainId: Symbol(), codeId: Symbol(), codeHash: Symbol(), transactionHash: Symbol() }
result   = await uploader.upload(artifact)

deepEqual(result, template)
ok(uploader.agent === agent)

artifact = { url: emptyContract }
template = Symbol()
agent    = { chain: { id: Symbol() }, upload: async (artifact) => template, nextBlock: Promise.resolve() }
uploader = new FSUploader(agent)
const results = await uploader.uploadMany([
  null,
  artifact,
  undefined,
  artifact,
  artifact,
  false
])
console.log(results)
deepEqual(results, [
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
  equal(d, d.setMany({test3: {test:3}, test4: {test:4}}))
  equal(d.get('missing'), null)
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

### Deploy classes

```typescript
import { DeployTask } from './deploy'
class DeployMyContracts extends DeployTask<Promise<{
  contract1: Client
  contract2: Client
}>> {
  constructor (context, ...args) {
    super(context, async () => [await this.contract1, await this.contract2])
  }
  contract1 = this.contract('Contract1').getOrDeploy('contract-1', {})
  contract2 = this.contract('Contract2').getOrDeploy('contract-2', async () => ({
    dependency: (await this.contract1).asLink
  }))
}
```

```typescript
import { connect } from '@fadroma/connect'
import { getDeployContext } from './deploy'
const context = await getDeployContext(await connect(await getChainContext({
  config: { chain: 'Mocknet' }
  deployment: {
    has () { return true }
    get (name) { return { address: name, codeHash: name } }
  },
  workspace: {},
  builder:   {},
  uploader:  {}
})))
```

```typescript
import { Client } from '@fadroma/client'
result = await DeployMyContracts.run(context)
assert(result instanceof Array)
assert(result[0] instanceof Client)
assert(result[1] instanceof Client)
```

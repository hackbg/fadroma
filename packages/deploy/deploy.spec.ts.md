# Fadroma Deploy Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, throws } from 'assert'
import { pathToFileURL } from 'url'
```

```typescript
import * as Fadroma from '@fadroma/client'
let chain:    Fadroma.Chain    = null
let agent:    Fadroma.Agent    = null
let mnemonic: string           = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let template: Fadroma.Contract = null
let artifact: Fadroma.URL      = pathToFileURL(Testing.fixture('empty.wasm'))
let chainId:  Fadroma.ChainId  = 'mocknet'
let codeId, codeHash, txHash, result
```

## Deploy events

```typescript
import { DeployConsole } from '.'
const log = new DeployConsole({
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.deployment({})
log.deployment({ deployment: { receipts: {}, prefix: '' } })
log.deployment({ deployment: { receipts: { x: { address: 'x' } }, prefix: '' } })
log.receipt('', '')
log.deployFailed(new Error(), {}, '', '')
log.deployManyFailed(new Error(), {}, [])
log.deployManyFailed(new Error(), {}, [['name', 'init']])
log.deployFailedTemplate()
```

## Deploy config

```typescript
import { DeployConfig } from '.'
let config: DeployConfig = new DeployConfig({}, '')
```

## Deploy context

```typescript
import { deploy, DeployContext, DeployConfig } from '.'
let context: DeployContext = await deploy({ chain: 'Mocknet', mnemonic })
ok(context                                 instanceof DeployContext)
ok(context.uploader                        instanceof Fadroma.Uploader)
ok(context.template('crate')               instanceof Fadroma.Contract)
ok(context.templates(['crate1', 'crate2']) instanceof Fadroma.Contracts)
ok(context.contract('crate')               instanceof Fadroma.Client)
ok(context.contracts()                     instanceof Fadroma.Contracts)
```

## Deploy task

```typescript
import { DeployTask } from '.'
new DeployTask()
```

## `FSUploader`: uploading local files

```typescript
import { FSUploader } from '.'

let uploader: Fadroma.Uploader = context.uploader
ok(uploader instanceof FSUploader)

await uploader.upload(new Fadroma.Contract({ artifact }))

await uploader.uploadMany([])

const testUpload = async (cb) => {
  const { template, uploader, uploaded } = await cb()
  ok(uploaded !== template)
  ok(uploaded.artifact?.toString() === template.artifact.toString())
  //ok(uploaded.uploader === uploader)
}

await testUpload(async () => {
  const template = new Fadroma.Contract(artifact)
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Contract({ artifact })
  const uploaded = await uploader.upload(template)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Contract(artifact)
  const uploaded = await template.upload(uploader)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Contract(artifact, { uploader })
  const uploaded = await template.upload(uploader)
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Contract({ artifact, uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})

await testUpload(async () => {
  const template = new Fadroma.Contract({ artifact }, { uploader })
  const uploaded = await template.upload()
  return { template, uploader, uploaded }
})
```

* Caching uploader

```typescript
import { Path, JSONDirectory, withTmpFile, withTmpDir } from '@hackbg/kabinet'
import { Uploads } from '.'
import { resolve } from 'path'

const mockAgent = () => new class MockAgent extends Fadroma.Agent {

  chain = new (class MockChain extends Fadroma.Chain {
    uploads = new class MockUploader extends Fadroma.Uploader {
      resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      make = () => new class MockFile {
        resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      }
    }
  })('mock')

  async upload () { return {} }

  instantiate (template, label, initMsg) {
    return new Client({ ...template, label, initMsg, address: 'some address' })
  }

  instantiateMany (configs, prefix) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      if (prefix) label = `${prefix}/${label}`
      receipts[name] = { codeId, label }
    }
    return receipts
  }

  async getHash () {
    return 'sha256'
  }

}

// 'add FSUploader to operation context' ({ ok }) {
agent = { chain: { uploads: Symbol() } }
const cache = new JSONDirectory()
uploader = new FSUploader(agent, cache)
ok(uploader.agent === agent)

// async 'upload 1 artifact with FSUploader#upload' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new FSUploader(agent, cache)
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.upload(new Fadroma.Contract({artifact})))
  })
})

// async 'upload any number of artifacts with FSUploader#uploadMany' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = mockAgent()
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

## `Deployment`, `Deployments`: keeping track of deployed contracts

```typescript
import { YAMLDeployment } from '.'
ok(new YAMLDeployment() instanceof Fadroma.Deployment)

import { Deployments } from '.'
new Deployments()
```

```typescript
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { YAMLDeployment } from '.'

const inTmpDeployment = cb => withTmpFile(f=>{
  const d = new YAMLDeployment(f, mockAgent())
  equal(d.prefix, basename(f))
  return cb(d)
})

await inTmpDeployment(async d => {
  deepEqual(d.state, {})
  equal(d, d.save('test', JSON.stringify({ foo: 1 })))
  equal(d, d.add('test1', { test1: 1 }))
  ok(!d.load())
  equal(d, d.set('test2', { test2: 2 }))
  equal(d, d.setMany({test3: {test:3}, test4: {test:4}}))
  equal(d.get('missing'), null)
})

// init contract from uploaded template
await inTmpDeployment(async deployment =>{
  const { prefix } = deployment
  const codeId     = 1
  const template   = new Fadroma.Contract({ chainId, codeId })
  const initMsg    = Symbol()
  const name       = 'contract'
  const label      = `${prefix}/${name}`

  const deployed   = await deployment.init(template, name, initMsg)
  ok(deployed instanceof Client)
  equal(deployed.deployment, deployment)
  equal(deployed.name,       name)
  equal(deployed.chainId,    chainId)
  equal(deployed.codeId,     codeId)
  equal(deployed.label,      label)

  const loaded = deployment.get(name)
  equal(loaded.deployment, deployment)
  equal(loaded.name,       name)
  equal(loaded.chainId,    chainId)
  equal(loaded.codeId,     codeId)
  equal(loaded.label,      label)
})

// init many contracts from the same template
await inTmpDeployment(async deployment=>{
  const {prefix} = deployment
  const codeId   = 2
  const template = new Fadroma.Contract({ chainId, codeId })
  const initMsg  = Symbol()
  const configs  = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts = await deployment.initMany(template, configs)
  for (const [name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, codeId)
  }
})

// init many contracts from different templates
await inTmpDeployment(async deployment=>{
  const templateA  = { codeId: 2 }
  const templateB  = { codeId: 3 }
  const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
  const receipts   = await deployment.initVarious(configs)
  for (const [template, name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, template.codeId)
  }
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
  assert(deployments.active instanceof Fadroma.Deployment)
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
import { Client } from '@fadroma/client'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dokeres'
import { BuildContext, getBuilder } from '@fadroma/build'
import { DeployContext } from '.'
inTmpDeployment(async deployment=>{
  context = await deploy({ chain: 'Mocknet', mnemonic }, new BuildContext())
  context.build.builder = getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  context.build.builder.build = x => Object.assign(x, { artifact: x.name })
  context.build.builder.codeHashForPath = () => 'codehash'
  context.deployment = deployment
  context.uploader   = uploader
  delete context.uploader.cache
  result = await DeployMyContracts.run(context)
  assert(result instanceof Array)
  assert(result[0] instanceof Client)
  assert(result[1] instanceof Client)
})
```

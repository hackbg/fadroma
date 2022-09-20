# Fadroma Deploy Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, throws } from 'assert'
import { pathToFileURL } from 'url'
```

```typescript
import { ChainId, Chain, Agent, Contract, Builder, Uploader, Deployment } from '@fadroma/client'
let chainId:  ChainId  = 'mocknet'
let chain:    Chain    = null
let agent:    Agent    = Testing.mockAgent()
let mnemonic: string   = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let template: Contract = null
let artifact: URL      = pathToFileURL(Testing.fixture('empty.wasm'))
let codeId, codeHash, txHash, result
```

## Deploy events

```typescript
import { DeployConsole } from '.'
const log = new DeployConsole({
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.deployment({})
log.deployment({ deployment: { name: '', state: {} } })
log.deployment({ deployment: { name: '', state: { x: { address: 'x' } } } })
log.receipt('', '')
log.deployFailed(new Error(), {}, '', '')
log.deployManyFailed({}, [], new Error())
log.deployManyFailed({}, [['name', 'init']], new Error())
log.deployFailedContract()
```

## Deploy config

```typescript
import { DeployConfig } from '.'
let config: DeployConfig = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }, '')
```

## Deploy context

```typescript
import { DeployContext } from '.'
let context: DeployContext = await config.getDeployContext()
ok(context            instanceof DeployContext)
ok(context.uploader   instanceof Uploader)
ok(context.contract() instanceof Contract)
```

## `Deployment` classes

```typescript
import { Client, Deployment } from '@fadroma/client'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dokeres'
import { BuildContext, getBuilder } from '@fadroma/build'
import { DeployConfig, DeployContext } from '.'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { ExampleDeployment } from './deploy.example'

ok(await new DeployConfig({
  FADROMA_CHAIN: 'Mocknet'
}).getDeployContext() instanceof DeployContext)

/*await Testing.inTmpDeployment(async deployment=>{
  context = await deploy({ chain: 'Mocknet', mnemonic }, new BuildContext())
  context.build.builder = getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  context.build.builder.build = x => Object.assign(x, { artifact: x.name })
  context.build.builder.hashPath = () => 'codehash'
  context.deployment = deployment
  delete context.uploader.cache
  const op = new ExampleDeployment(context)
  op.task = {}
  context.agent = Testing.mockAgent()
  result = await op.run()
  assert(result    instanceof Array)
  assert(result[0] instanceof Contract)
  assert(result[1] instanceof Contract)
})*/
```

## Deploy store

```typescript
import { DeployStore, YAMLDeployments_v1, Deploy } from '.'
import { withTmpDir } from '@hackbg/kabinet'
import { existsSync } from 'fs'

// deployments
await withTmpDir(async dir=>{
  const deployments = new YAMLDeployments_1(dir)
  ok(YAMLDeployments_1 instanceof DeployStore)
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

## `FSUploader`: uploading local files

```typescript
import { FSUploader } from '.'
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
}

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

## `Deployment`: collection of contracts

```typescript

await Testing.inTmpDeployment(async d => {
  deepEqual(d.state, {})
  equal(d, d.save('test', JSON.stringify({ foo: 1 })))
  equal(d, d.add('test1', { test1: 1 }))
  ok(!d.load())
  equal(d, d.set('test2', { test2: 2 }))
  equal(d, d.setMany({test3: {test:3}, test4: {test:4}}))
  equal(d.get('missing'), null)
})

// init contract from uploaded template
await Testing.inTmpDeployment(async deployment => {

  const codeId   = 1
  const template = new Contract({ chainId, codeId })
  const initMsg  = Symbol()
  const name  = 'contract'
  const label = `${deployment.name}/${name}`
  const crate = 'foo'

  deployment.builder  = { build: x => x }
  deployment.uploader = { upload: x => x, agent }

  const contract = deployment.contract({ template, name, crate })
  ok(contract instanceof Contract)
  equal(contract.deployment, deployment)

  const deployed = await contract.deploy(initMsg, contract => contract.client())
  ok(deployed instanceof Client)
  equal(deployed.name,  name)
  equal(deployed.label, label)

  const loaded = deployment.get(name)
  ok(loaded)
  ok(loaded instanceof Contract)
  equal(loaded.deployment, deployment)
  equal(loaded.name, name)
  //equal(loaded.chainId, chainId)
  //equal(loaded.codeId, codeId)
  equal(loaded.label, label)

})

// init many contracts from the same template
await Testing.inTmpDeployment(async deployment=>{
  const codeId   = 2
  const template = new Contract({ agent, chainId, codeId })
  const initMsg  = Symbol()
  const configs  = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts = await deployment.contract(template).deployMany(configs)
  /*for (const [name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, codeId)
  }*/
})

// init many contracts from different templates
/*await Testing.inTmpDeployment(async deployment=>{
  const templateA  = { codeId: 2 }
  const templateB  = { codeId: 3 }
  const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
  const receipts   = await deployment.initVarious(configs)
  for (const [template, name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, template.codeId)
  }
})*/
```

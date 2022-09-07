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
let config: DeployConfig = new DeployConfig({}, '')
```

## Deploy context

```typescript
import { deploy, DeployCommands, DeployConfig } from '.'
let context: DeployCommands = await deploy({ chain: 'Mocknet', mnemonic })
ok(context             instanceof DeployCommands)
ok(context.uploader    instanceof Fadroma.Uploader)
ok(context.contract()  instanceof Fadroma.Contract)
ok(context.contracts() instanceof Fadroma.Contracts)
```

## `Deployment` classes

```typescript
import { Client } from '@fadroma/client'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dokeres'
import { BuildCommands, getBuilder } from '@fadroma/build'
import { deploy, DeployCommands, YAMLDeployment } from '.'
import { DeployMyContracts } from '../client/client.spec.ts.md'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'

ok(await deploy() instanceof DeployCommands)

ok(new YAMLDeployment() instanceof Fadroma.Deployment)
const inTmpDeployment = cb => withTmpFile(f=>{
  const d = new YAMLDeployment(f, Testing.mockAgent())
  equal(d.name, basename(f))
  return cb(d)
})
inTmpDeployment(async deployment=>{
  context = await deploy({ chain: 'Mocknet', mnemonic }, new BuildCommands())
  context.build.builder = getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  context.build.builder.build = x => Object.assign(x, { artifact: x.name })
  context.build.builder.codeHashForPath = () => 'codehash'
  context.deployment = deployment
  delete context.uploader.cache
  result = await DeployMyContracts.run(context)
  assert(result instanceof Array)
  assert(result[0] instanceof Client)
  assert(result[1] instanceof Client)
})
```

## `Deployments` directory

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

## `FSUploader`: uploading local files

```typescript
import { FSUploader } from '.'

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
}

// 'add FSUploader to operation context' ({ ok }) {
agent = { chain: { uploads: Symbol() } }
const cache = new JSONDirectory()
uploader = new FSUploader(agent, cache)
ok(uploader.agent === agent)

// async 'upload 1 artifact with FSUploader#upload' ({ ok }) {
await withTmpDir(async cacheDir=>{
  const agent    = Testing.mockAgent()
  const cache    = new Path(cacheDir).in('uploads').as(JSONDirectory)
  const uploader = new FSUploader(agent, cache)
  await withTmpFile(async location=>{
    const url = pathToFileURL(location)
    ok(await uploader.upload(new Fadroma.Contract({artifact})))
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

## `Deployment`, `Deployments`: keeping track of deployed contracts

```typescript

import { Deployments } from '.'
new Deployments()
```

```typescript

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
  const codeId     = 1
  const template   = new Fadroma.Contract({ chainId, codeId })
  const initMsg    = Symbol()
  const name       = 'contract'
  const label      = `${deployment.name}/${name}`

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

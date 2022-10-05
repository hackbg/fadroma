# Fadroma Deploy Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, throws } from 'assert'
```

## `DeployConfig`: Deploy configuration options

Interacting with the Fadroma Deploy package starts by creating a `DeployConfig`:

* It fetches configuration from environment variables

* It produces configured `DeployStore` and `Deployer` instances.

```typescript
import { DeployConfig } from '.'
let config: DeployConfig = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }, process.cwd())
ok(new config.DeployStore() instanceof DeployStore)
await config.getDeployStore()
await config.getDeployer()
```

## `Deployer`: The deploy context

The `Deployer` class extends `Deployment` (from `@fadroma/client`)
by way of `Connector` (from `@fadroma/connect`), adding handling for
**deploy receipts**, which are records of all the contracts of a `Deployment`:

* Saving the current `state` of the `Deployment` to the active `DeployStore`
  in the form of a **deploy receipt**.

* Replacing the current state of a `Deployment` with that from a deploy receipt.

* Listing and creating deploy receipts; marking one of them as "active".

```typescript
import { Deployer } from '.'
import { Path } from '@hackbg/kabinet'
let context: Deployer = await config.getDeployer()
ok(context         instanceof Deployer)
ok(context.config  instanceof DeployConfig)
ok(context.store   instanceof DeployStore)
ok(context.project instanceof Path)
ok(await context.provideStore())
ok(await context.listDeployments())
ok(await context.createDeployment())
ok(await context.selectDeployment())
ok(await context.listContracts() ?? true)
ok(await context.save() ?? true)
```

## `Deployment` classes

```typescript
import { Client, Deployment } from '@fadroma/client'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dokeres'
import { BuildContext, getBuilder } from '@fadroma/build'
import { DeployConfig, Deployer } from '.'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { ExampleDeployment } from './deploy.example'
import { pathToFileURL } from 'url'

ok(await new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }).getDeployer() instanceof Deployer)

let mnemonic: string   = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let artifact: URL      = pathToFileURL(Testing.fixture('empty.wasm'))
let codeId, codeHash, txHash, result
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
import { DeployStore, YAML1, YAML2, JSON1 } from '.'
import { withTmpDir } from '@hackbg/kabinet'
import { existsSync } from 'fs'

// deployments
for (const DeployStore of [
  YAML1.YAMLDeployments_v1,
  //YAML2.YAMLDeployments_v2, // TODO
  //JSON1.JSONDeployments_v1, // TODO
]) {
  await withTmpDir(async dir=>{
    const deployments = new YAML1.YAMLDeployments_v1(dir)
    ok(deployments instanceof DeployStore)
    ok(deployments.root.path === dir)
    await deployments.create('test-deployment-1')
    await deployments.create('test-deployment-2')
    await deployments.select('test-deployment-1')
    await deployments.select('test-deployment-2')
    assert(deployments.active instanceof Deployment)
    deployments.get()
    deployments.list()
    deployments.set('test', 'test')
  })
}
```

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

## `Deployment`: collection of contracts

```typescript
import { ChainId } from '@fadroma/client'
let chainId: ChainId  = 'mocknet'

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

## Deploy events

Like the other packages of the Fadroma suite, Fadroma Deploy exposes
a custom console logger based on `@hackbg/konzola`.

```typescript
import { DeployConsole } from '.'
const log = new DeployConsole()
log.console = {
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
}
log.deployment({})
log.deployment({ deployment: { name: '', state: {} } })
log.deployment({ deployment: { name: '', state: { x: { address: 'x' } } } })
log.receipt('', '')
log.deployFailed(new Error(), {}, '', '')
log.deployManyFailed({}, [], new Error())
log.deployManyFailed({}, [['name', 'init']], new Error())
log.deployFailedContract()
```

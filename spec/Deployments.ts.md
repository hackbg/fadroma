# Fadroma Deploy Specification

This package implements **uploading contracts from the filesystem**,
as well as **keeping track of contracts instantiated through the Fadroma Core API**.

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

Both uploading and instantiation are *idempotent* actions:
* Contract instances are only deployed *once*.
* While you can upload the same code to a chain multiple times, getting different code IDs,
  it only makes sense to upload it *once*.

Therefore, caching is implemented in the form of:
* **Deploy receipts**: records of one or more deployed contract instances.
* **Upload receipts**: records of a single uploaded contract binary.

This package concerns itself chiefly with the handling of deploy and upload receipts,
and defines the following entities:

## [Uploading contract binaries](./upload.spec.ts)

* `FSUploader`: upload compiled code to the chain from local files.
* **TODO:** `FetchUploader`, which supports uploading code from remote URLs.

```typescript
import './upload.spec.ts.md'
```

## [Storing deployed contract instances](./deploy-base.spec.ts)

* `DeployConfig`: configure deployer through environment variables.
* `Deployer`: a subclass of `Deployment` which stores deploy receipts
  in a specific `DeployStore` and can load data from them into itself.

```typescript
import './deploy-base.spec.ts.md'
```

## [Deploy store variants](./deploy-variants.spec.ts)

Several of those are currently supported for historical and compatibility reasons.

* `YAML1.YAMLDeployments_v1` and `YAML2.YAMLDeploymentss_v2` are ad-hoc
  storage formats used by the original deployer implementations.
* `JSON1.JSONDeployments_v1` is the first version of the stable deploy receipt API.

```typescript
import './deploy-store.spec.ts.md'
```

## [Deploy logging and errors]('./deploy-events.spec.ts.md)

```typescript
import './deploy-events.spec.ts.md'
```
# Fadroma Deploy Base Specification

```typescript
import { ok, equal, deepEqual } from 'node:assert'
```

## `DeployConfig`: Deploy configuration options

Interacting with the Fadroma Deploy package starts by creating a `DeployConfig`:
  * It fetches configuration from environment variables
  * It produces configured `DeployStore` instances.
  * It produces configured `Deployer` instances.

```typescript
import { DeployConfig, DeployStore } from '@fadroma/deploy'
let config: DeployConfig = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }, process.cwd())
ok(new config.DeployStore() instanceof DeployStore)
await config.getDeployStore()
await config.getDeployer()
```

## `Deployer`: The deploy context

The `Deployer` class extends `Deployment` (from `@fadroma/core`)
by way of `Connector` (from `@fadroma/connect`), adding handling for
**deploy receipts**, which are records of all the contracts of a `Deployment`:
  * Saving the current `state` of the `Deployment` to the active `DeployStore`
    in the form of a **deploy receipt**.
  * Replacing the current state of a `Deployment` with that from a deploy receipt.
  * Listing and creating deploy receipts; marking one of them as "active".

```typescript
import { Deployer } from '.'
import { Path } from '@hackbg/file'
let context: Deployer = await config.getDeployer()
ok(context         instanceof Deployer)
ok(context.config  instanceof DeployConfig)
ok(context.store   instanceof DeployStore)
ok(context.project instanceof Path)
ok(await context.provideStore())
ok(await context.provideStore(true))
ok(await context.listDeployments())
ok(await context.createDeployment())
ok(await context.selectDeployment())
ok(await context.listContracts() ?? true)
ok(await context.save() ?? true)
```

## `Deployment` classes

```typescript
import { Client, Deployment } from '@fadroma/core'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dock'
import { BuildContext, getBuilder } from '@fadroma/build'
import { DeployConfig, Deployer } from '.'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/file'
import { ExampleDeployment } from './deploy.example'
import { pathToFileURL } from 'url'
import { examples, inTmpDeployment } from '../../TESTING.ts.md'

ok(await new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }).getDeployer() instanceof Deployer)

let mnemonic: string   = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let artifact: URL      = examples['KV'].url
let codeId, codeHash, txHash, result
/*await inTmpDeployment(async deployment=>{
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

## `Deployment`: collection of contracts

```typescript
import { ChainId, ContractSlot, ContractTemplate } from '@fadroma/core'
let chainId: ChainId  = 'mocknet'

await inTmpDeployment(async d => {
  deepEqual(d.state, {})
  d.save('test', JSON.stringify({ foo: 1 }))
  d.add('test1', { test1: 1 })
  d.set('test2', { test2: 2 })
  d.setMany({test3: {test:3}, test4: {test:4}})
  equal(d.get('missing'), null)
})

// init contract from uploaded template
await inTmpDeployment(async deployment => {

  const codeId   = 1
  const template = new ContractTemplate({ chainId, codeId })
  const initMsg  = Symbol()
  const name  = 'contract'
  const label = `${deployment.name}/${name}`
  const crate = 'foo'

  deployment.builder  = { build: x => x }
  deployment.uploader = { upload: x => x, agent: {} }

  const contract = deployment.contract({ template, name, crate })
  ok(contract instanceof ContractSlot)
  //equal(contract.deployment, deployment)

  //const deployed = await contract.deploy(initMsg, contract => contract.client())
  //ok(deployed instanceof Client)
  //equal(deployed.name,  name)
  //equal(deployed.label, label)

  //const loaded = deployment.get(name)
  //ok(loaded)
  //ok(loaded instanceof Contract)
  //equal(loaded.deployment, deployment)
  //equal(loaded.name, name)
  //equal(loaded.chainId, chainId)
  //equal(loaded.codeId, codeId)
  //equal(loaded.label, label)

})

// init many contracts from the same template
await inTmpDeployment(async deployment=>{
  const codeId   = 2
  const agent    = { instantiateMany: async () => [] }
  const template = new ContractTemplate({ chainId, codeId })
  const initMsg  = Symbol()
  const configs  = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts = await deployment.contracts(template).define({ agent }).deploy(configs)
  /*for (const [name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, codeId)
  }*/
})

// init many contracts from different templates
/*await inTmpDeployment(async deployment=>{
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
## Deploy store

```typescript
import assert, { ok, equal, deepEqual, throws } from 'node:assert'
```

```typescript
import { Deployment } from '@fadroma/core'
import { DeployStore, YAML1, YAML2, JSON1 } from '@fadroma/deploy'
import { withTmpDir } from '@hackbg/file'

// deployments
for (const $DeployStore of [
  YAML1.YAMLDeployments_v1,
  //YAML2.YAMLDeployments_v2, // TODO
  //JSON1.JSONDeployments_v1, // TODO
]) {
  await withTmpDir(async dir=>{

    const deployments = new $DeployStore(dir)
    ok(deployments instanceof DeployStore)
    ok(deployments.root.path === dir)

    assert.rejects(deployments.select('missing'))

    assert(!deployments.active)
    await deployments.create()

    await deployments.create('test-deployment-1')
    await deployments.create('test-deployment-2')
    await deployments.select('test-deployment-1')
    assert(deployments.active instanceof Deployment)
    await deployments.select('test-deployment-2')
    assert(deployments.active instanceof Deployment)

    deployments.get()
    deployments.list()
    deployments.set('test', { key: 'value' })

  })
}
```

## `DeployConfig`: Deploy configuration options

Interacting with the Fadroma Deploy package starts by creating a `DeployConfig`:
  * It fetches configuration from environment variables
  * It produces configured `DeployStore` instances.
  * It produces configured `Deployer` instances.

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

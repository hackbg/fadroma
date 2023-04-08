# Fadroma Deploy Specification

## Deploy CLI

```sh
$ fadroma deploy
$ fadroma deploy path-to-script.ts
$ fadroma redeploy
```

## Deploy API

### Defining a deployment

To define your deployment, extend the `Deployment` class:

```typescript
import { Deployment } from '@fadroma/agent'

export class MyDeployment extends Deployment {
  foo = this.contract({
    name: 'foo'
  })
  bar = this.contract({
    name: 'bar'
  })
}
```

### Deploying

To prepare a deployment for deploying, use `getDeployment`.
This will provide a populated instance of your deployment class.

```typescript
import { getDeployment } from '@fadroma/ops'
let deployment = getDeployment(MyDeployment, /* ...constructor args */)
```

Then, call its `deploy` method:

```typescript
await deployment.deploy()
```

The default `Deployment#deploy` method simply instantiates all
contracts defined using the `Deployment#contract` method. To
implement a custom deploy order, you can override `deploy`,
for example:

```typescript
await getDeployment(class MyDeployment2 extends MyDeployment {
  async deploy () {
    await this.foo.deployed
    await this.bar.deployed
  }
})
```

### Deploy configuration

Both uploading and instantiation are *idempotent* actions:
* Contract instances are only deployed *once*.
* While you can upload the same code to a chain multiple times, getting different code IDs,
  it only makes sense to upload it *once*.

Therefore, caching is implemented in the form of:

This package concerns itself chiefly with the handling of deploy and upload receipts,
and defines the following entities:

### Deployment

```typescript
import { DeployConfig } from '@fadroma/ops'
const config = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' })

ok(await config.getDeployment() instanceof Deployer)

import { Client, Deployment } from '@fadroma/agent'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dock'
import { BuildContext, getBuilder, DeployConfig } from '@fadroma/ops'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/file'
import { ExampleDeployment } from './deploy.example'
import { pathToFileURL } from 'url'
import { examples } from '../examples/Examples.spec.ts.md'

let mnemonic: string = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let artifact: URL = examples['KV'].url
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

```typescript
import { ChainId, Contract, Template } from '@fadroma/agent'
let chainId: ChainId  = 'mocknet'

await inTmpDeployment(async deployment => {
  deepEqual(deployment.state, {})
  /*deployment.save('test', JSON.stringify({ foo: 1 }))
  deployment.add('test1', { test1: 1 })
  deployment.set('test2', { test2: 2 })
  deployment.setMany({test3: {test:3}, test4: {test:4}})*/
  //equal(deployment.get('missing'), null)
})

// init contract from uploaded template
await inTmpDeployment(async deployment => {

  const codeId   = 1
  const template = new Template({ chainId, codeId })
  const initMsg  = Symbol()
  const name  = 'contract'
  const label = `${deployment.name}/${name}`
  const crate = 'foo'

  deployment.builder  = { build: x => x }
  deployment.uploader = { upload: x => x, agent: {} }

  const contract = deployment.contract({ template, name, crate })
  ok(contract instanceof Contract)
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
  const template = new Template({ chainId, codeId })
  const initMsg  = Symbol()
  const configs  = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts = await deployment.template(template).instances(configs)
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

### DeployCommands

  * Saving the current `state` of the `Deployment` to the active `DeployStore`
    in the form of a **deploy receipt**.
  * Replacing the current state of a `Deployment` with that from a deploy receipt.
  * Listing and creating deploy receipts; marking one of them as "active".

```typescript
import { Path } from '@hackbg/file'
let context: Deployment = await config.getDeployment()
ok(context         instanceof Deployment)
ok(context.config  instanceof DeployConfig)
ok(context.store   instanceof DeployStore)
ok(context.project instanceof Path)
//ok(await context.provideStore())
//ok(await context.provideStore(true))
//ok(await context.listDeployments())
//ok(await context.createDeployment())
//ok(await context.selectDeployment())
//ok(await context.listContracts() ?? true)
//ok(await context.save() ?? true)
```

### Deploy store

Several of those are currently supported for historical and compatibility reasons.

#### YAML1

* `YAML1.YAMLDeployments_v1` and `YAML2.YAMLDeploymentss_v2` are ad-hoc
  storage formats used by the original deployer implementations.

#### JSON1

* `JSON1.JSONDeployments_v1` is the first version of the stable deploy receipt API.

```typescript
import { Deployment } from '@fadroma/agent'
import { DeployStore, YAML1, YAML2, JSON1 } from '@fadroma/ops'
import { withTmpDir } from '@hackbg/file'

// deployments
for (const $DeployStore of [
  YAML1,
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

### Deployment events

```typescript
import { DeployConsole } from '@fadroma/ops'

const log = new DeployConsole()
log.console = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} }

log.deployment({})
log.deployment({ deployment: { name: '', state: {} } })
log.deployment({ deployment: { name: '', state: { x: { address: 'x' } } } })

log.receipt('', '')

log.deployFailed(new Error(), {}, '', '')

log.deployManyFailed({}, [], new Error())
log.deployManyFailed({}, [['name', 'init']], new Error())

log.deployFailedContract()

log.warnNoDeployment()
log.warnNoAgent()
log.warnNoDeployAgent()

log.deployStoreDoesNotExist()
```

## Deploying contracts

>“Tell me, as you promised!” implored the Master of space-time,
>hot tears thundering to the earth like mighty comets,
>“What is the shape of the universe?”
>“It is somewhat wheel-shaped,” said Aesma,
>which was a completely wrong answer.
>*-Abbadon*

Cosmos contracts can be seen as essentially equivalent to **persistent objects**:
they encapsulate some data alongside the methods used to operate on that data.
In this model, instantiating a contract is equivalent to constructing an object,
which then continues to exist forever on an append-only ledger of transactions.

The details are slightly more involved, since you need to compile the code and
upload it to the network before you can instantiate and operate it. That's why,
in order to deploy a contract, you must first describe it.

Fadroma provides the `Contract` object for that purpose:

```typescript
import { Contract } from '@fadroma/agent'
const nullContract = deployment.contract()
assert(nullContract instanceof Contract)
```

This gives you an instance of the `Contract` class, representing a specific instance of a
specific contract. The `Contract` class represents the fullest description of a smart contract
in the Fadroma model: besides the usual address and code hash, it may contain info about
contract source, upload and init transactions, etc. (In comparison, `Template` contains metadata
up to right before instantiation, and `Client` does not concern itself with where the contract
came from.)

```typescript
assert.rejects(async () => await nullContract.deployed)
```

### Test preparation

To simplify this test, we'll stub out the external world. Let's create test-only instances of
`Chain` and `Agent`:

```typescript
import { Chain } from '@fadroma/agent'
let index = 0
const chain = new Chain('test')
const agent = Object.assign(await chain.getAgent(), {
  async instantiate () { return { address: `(address #${ ++index })` } },
  async execute     () { return {} },
  async query       () { return {} }
})
```

### Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md)
(that is, a contract that is already built and uploaded):

```typescript
const aContract = deployment.contract({
  name: 'contract1',
  initMsg: { parameter: 'value' },
  codeId: 1,
})

assert(aContract instanceof Contract)

const bContract = deployment
  .template({ codeId: 1 })
  .instance({ name: 'contract1', initMsg: { parameter: 'value' } })

assert(bContract instanceof Contract)
```

To deploy the contract uploaded as code ID 1, just call `aContract`, passing two things:
* an **instance ID**. This is the "friendly name" of the contract instance,
  and is used to construct its full unique label.
* an **init message**. This contains the "constructor parameters" that will be passed to the
  contract's init method.

```typescript
const aClient = await aContract.deployed
```

The call will resolve resolve to a `Client` instance. You can use this to talk to the deployed
contract by invoking its query and transaction methods.

```typescript
import { Client } from '@fadroma/agent'
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(address #1)')
assert.equal(typeof aClient.query,   'function')
assert.equal(typeof aClient.execute, 'function')
```

Congratulations, you've deployed a globally persistent object!

### Interacting with contracts using the `Client`

The result of deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

#### `client.meta`

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(aClient.meta instanceof Contract)
assert.equal(aClient.meta.deployedBy, agent.address)
```

#### `client.agent`

By default, the `Client`'s `agent` property is equal to the `agent`
which deployed the contract. This property determines the address from
which subsequent transactions with that `Client` will be sent.

In case you want to deploy the contract as one identity, then interact
with it from another one as part of the same procedure, you can set `agent`
to another instance of `Agent`:

```typescript
assert.equal(aClient.agent, agent)
aClient.agent = await chain.getAgent()
```

### Retrieving existing contracts from the `Deployment`

> You can't step in the same river twice
> *-Parmenides*

Since chains are append-only, and contract labels are unique,
it's not possible to deploy a contract more than once, or
deploy another contract with the same label as an existing one.

Enter the `Deployment` object, which keeps track of the contracts that you deploy.

```typescript
import { Deployment } from '@fadroma/agent'
deployment = new Deployment({
  name: 'testing'
  agent,
})
```

Then, you can use `deployment.contract` in place of `new Contract()`:

```typescript
const contractOne = deployment.contract({
  codeId: 1,
  name: 'name',
  initMsg: { parameter: 'value' }
})
```

Deployments add their names to the labels of deployed contracts:

```typescript
const clientToContractOne = await contractOne.deploy()
assert.equal(clientToContractOne.meta.label, 'testing/name')
assert.equal(clientToContractOne.meta.address, '(address #2)')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract:

```typescript
const anotherClientToContractOne = await contractOne.expect()
assert.equal(clientToContractOne.address, anotherClientToContractOne.address)
```

This creates a new `Client` pointing to the same contract.

### Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const template = await deployment.template({ codeId: 2 })
const templateClientOne = await template.instance({ name: 'template-instance-1', initMsg: {} })
const templateClientTwo = await template.instance({ name: 'template-instance-2', initMsg: {} })
assert.equal(templateClientOne.address,    '(address #3)')
assert.equal(templateClientTwo.address,    '(address #4)')
assert.equal(templateClientOne.meta.label, 'testing/template-instance-1')
assert.equal(templateClientTwo.meta.label, 'testing/template-instance-2')
```

### Deploying multiple instances

To deploy multiple contract instances from the same code,
you can use templates.

You can pass either an array or an object to `template.instances`:

```typescript
const [ templateInsanceThree, templateClientFour ] = await template.instances([
  { name: 'name3', initMsg: { parameter: 'value3' } },
  { name: 'name4', initMsg: { parameter: 'value4' } },
])
const { templateClientFoo, templateClientBar } = await template.instances({
  templateClientFoo: { name: 'name5', initMsg: { parameter: 'value5' } },
  templateClientFoo: { name: 'name6', initMsg: { parameter: 'value6' } },
})
```

```typescript
import assert, { ok, equal, deepEqual } from 'node:assert'
import { Deployment } from '@fadroma/agent'
import { withTmpFile } from '@hackbg/file'
import { mockAgent } from '../examples/Examples.spec.ts.md'
function inTmpDeployment (cb) {
  return withTmpFile(f=>{
    const d = new Deployment(f, mockAgent())
    return cb(d)
  })
}
```

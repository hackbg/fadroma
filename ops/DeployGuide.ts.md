# Deploying and configuring smart contracts with Fadroma Ops

The following is a guide to understanding and using the smart contract
deployment system, Fadroma Ops.

## Example: deploying a contract

* `project/package.json`:

```json
{
  "devDependencies": {
    "fadroma": "^1.0.0"
  }
}
```

* `project/ops.ts`:

```typescript
#!/usr/bin/env fadroma-deploy
import Fadroma from '@hackbg/fadroma'

export class Project extends Fadroma {

  deploy = this.command('deploy', 'deploy an instance of my-contract', async () => {
    this.log.info('Deploying...')
    await this.context.contract('MyContract').deploy('my-contract')
  })

  status = this.command('status', 'print status of deployed contract', async () => {
    this.log.info('Querying status...')
    const contract = await context.contract('MyContract').get('Deploy the contract first.').populate()
    console.debug(contract)
  })

}

export default Project.run()

/** add more commands here */
```

* run with `npx fadroma <SCRIPT> <COMMAND> <ARGUMENTS>`

```shell
npx fadroma ops.ts deploy
npx fadroma ops.ts status
```

* or add to `package.json` scripts to run with e.g. `npm run ops`:

```json
{
  "scripts": {
    "ops": "fadroma ops.ts"
  }
}
```

:::info
### TypeScript

Fadroma will use [Ganesha](https://github.com/hackbg/ganesha) to compile
deployment scripts on each run. You can use TypeScript seamlessly in your
deploy procedures.
:::

## How to define commands

The **Commands#command(name, info, ...steps)** method declares commands.

  * **name** is the string used to invoke the command from the shell
  * **info** is a short help description
  * **...steps** is one or more synchronous or asynchronous functions that constitute the command.

**Steps** are run sequentially. The first argument to each step is a `context: Deployer`.
If a step returns an `Object`, the object's entries are added to the `context` for subsequent
steps.

:::info
### Commands

* The `commands.command(...)` method returns `commands`, so it supports chaining.
* Don't forget to `export default commands`, otherwise Fadroma will not be able to find the commands.
* Fadroma uses [`@hackbg/cmds`](https://github.com/hackbg/toolbox/blob/main/cmds/cmds.ts)
  to parse commands. This is a simple and loose command parser which does not support flags.
  Arguments to a command are available in `context.args` so you can define your own flags.
:::

## How to deploy contracts

The `context.contract(name, Client?)` method, which returns a `ContractSlot` - a placeholder
representing a contract that might or might not already be deployed. You can optionally specify
a custom `Client` class used to interact with the deployed contract.

  * `await context.contract(name, Client?).getOrDeploy(source, init)` is the most handy method
    of `ContractSlot`: if a contract is found by `name` in the current deployment, it returns that;
    otherwise, it deploys `source` with the specified `init` message and auto-generated label.
  * `await context.contract(name, Client?).deploy(source, init)` deploys a contract from `source`
    with the specified `init` msg and an auto-generated label; but if a contract with the same
    label already exists on the chain, the call will fail.
  * `context.contract(name, Client?).get(message)` looks up a contract by `name` in the current
    deployment; if the contract is not found in the deployment, `message` is thrown.

:::info
### Receipts

The **deployment receipt system** keeps track of the addresses, code ids, code hashes, and other
info about the smart contracts that you deployed, in the form of files under
`receipts/$CHAIN_ID/$DEPLOYMENT.yml`.

Besides `context.contract.get()` and `.getOrDeploy()`, you can access it directly via:
* `context.deployment: Deployment`: handle to currently selected deployment.
* `context.deployments: Deployments`: deployment directory for current project and chain,
  listing other deployments.

The deployments system prefixes all contract labels with the name of the deployment.
This is because labels are expected to be both meaningful and globally unique.

* So if you `name` your contracts `ALICE` and `BOB`, and your deployment is called `20220706`,
  the on-chain labels of the contracts will be `20220706/ALICE` and `20220706/BOB`.

* The timestamp here corresponds to the moment the deployment was created, and not the moment
  when a particular contract was deployed. You can get the latter by looking at `initTx` in the
  deployment receipt, and querying that transaction in the transaction explorer.

* We recommend that you keep receipts of your primary mainnet and testnet deployments in your
  VCS system, in order to keep track of your project's footprint on public networks.
:::

:::info
`init` can be either an init message, or a function returning an init message.

This is useful when there is [extra preparation](#templates-and-factories) needed when deploying a contract,
but you don't want to repeat those steps if the contract is already deployed.
:::

## Templates and factories

Sometimes you want to upload a contract to the chain, but not instantiate it. For example,
one of your contracts serves a factory and deploys new instances of another contract.
Fadroma calls a contract in that state (deployed, but not instantiated) a `Template`.
It doesn't have an `address`, just an `id` and `codeHash` that can be used to instantiate it.

You can use the `context.template(source)` method to get a `TemplateSlot` representing a
template; similar to `ContractSlot`, its methods are `get(message)`, `async upload()` and
`async getOrUpload()`.

### Example: deploying a factory contract with a template

The following function only deploys the factory context if it's not already deployed,
and uploads its template only if needed.

```typescript
async function idempotentlyDeployFactoryAndTemplate (context) {
  await context.contract('Factory').getOrDeploy('factory', () => {
    const { id, codeHash } = await context.template('product').getOrUpload()
    return { id, code_hash: codeHash }
  })
}
```

## Deploying in bulk

Sometimes it is useful to deploy multiple contracts in a single transaction.

* `context.contracts(Client?).deployMany(source, inits: [name, init][])`
  deploys multiple instances of the same `source`, each with a different `name` and `init`.
* `context.templates([template1, template2]).uploadMany()` uploads multiple different templates,
  as in the case when a factory contract is able to instantiate multiple different contracts.

## Class-based deployments

More complex deployments (such as that of a whole subsystem consisting of multiple contracts)
can be expressed as classes, by inheriting from `Fadroma.DeployTask`.

The semantics of class-based deployments approach a declarative workflow: by using `this.task`
to wrap the individual stages of the deployment and awaiting the result of the deployment in the
main function defined in the constructor, the structure of the deployment procedure becomes a
directed acyclic graph.

In other words:
* Subtasks only execute when `await`ed.
* Subtasks can `await` each other to define inter-contract dependencies as well as dependencies on
  other data sources.
* Instances of `DeployTask` can also be `await`ed, returning an object the ultimate result of the
  deployment.

Here's an example script containing one class-based deployment procedure:

```typescript
#!/usr/bin/env fadroma-deploy
import Fadroma from '@hackbg/fadroma'
export default new FadromaCommands('deploy')
  .command('group', 'deploy multiple interdependent contracts', DeployPair.run)

class DeployPair extends DeployTask<Promise<[Fadroma.Client, Fadroma.Client]>> {
  constructor (context, ...args) {
    super(context, async () => [await this.contract1, await this.contract2])
  }
  contract1 = this.contract('Contract1').getOrDeploy('contract-1', {})
  contract2 = this.contract('Contract2').getOrDeploy('contract-2', async () => ({
    dependency: (await this.contract1).asLink
  }))
}
```
{
  "name": "@fadroma/docs",
  "private": true
}


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

assert.ok(await config.getDeployment() instanceof Deployment)

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
  assert.deepEqual(deployment.state, {})
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
  assert.ok(contract instanceof Contract)
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
assert.ok(context         instanceof Deployment)
assert.ok(context.config  instanceof DeployConfig)
assert.ok(context.store   instanceof DeployStore)
assert.ok(context.project instanceof Path)
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
import assert from 'node:assert'
import { Deployment } from '@fadroma/agent'
import { withTmpFile } from '@hackbg/file'
import { mockAgent } from '../examples/Examples.spec.ts.md'
function inTmpDeployment (cb) {
  return withTmpFile(f=>{
    const d = new Deployment(f, mockAgent())
    return cb(d)
  })
}
import { Client } from '@fadroma/agent'
```

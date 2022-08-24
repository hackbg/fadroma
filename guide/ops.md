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
import Fadroma from '@hackbg/fadroma'
const console = Fadroma.Console('MyDeploy')
export default new Fadroma.DeployCommands('deploy')
  .command('deploy', 'deploy an instance of my-contract', deployMyContract)
  .command('status', 'print status of deployed contract', statusOfContract)

async function deployMyContract (context) {
  console.info('Deploying...')
  await context.contract('MyContract').deploy('my-contract')
}

async function statusOfContract (context) {
  console.info('Querying status...')
  const contract = await context.contract('MyContract').get('Deploy the contract first.').populate()
  console.debug(contract)
}

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
Fadroma will use [Ganesha](https://github.com/hackbg/ganesha) to compile
deployment scripts on each run. You can use TypeScript seamlessly in your
deploy procedures.
:::

## How to define commands

The **Commands#command(name, info, ...steps)** method declares commands.

  * **name** is the string used to invoke the command from the shell
  * **info** is a short help description
  * **...steps** is one or more synchronous or asynchronous functions that constitute the command.

**Steps** are run sequentially. The first argument to each step is a `context: DeployContext`.
If a step returns an `Object`, the object's entries are added to the `context` for subsequent
steps.

:::info
The `commands.command(...)` method returns `commands`, so it supports chaining.
:::

:::info
Don't forget to `export default commands`, otherwise Fadroma will not be able to find the commands.
:::

## Deployment context

### How deployments are stored

The **deployment receipt system** keeps track of the addresses, code ids, code hashes, and other
info about the smart contracts that you deployed, in the form of files under
`receipts/$CHAIN_ID/$DEPLOYMENT.yml`.

* `context.deployments: Deployments`: list of all deployments for the current project and chain.
* `context.deployment: Deployment`: handle to currently selected deployment.


:::info
It is recommended to keep receipts for mainnet and testnet in your VCS
in order to keep track of the contracts that you deploy to public networks.
:::

:::info
The deployments system prefixes all contract labels with the name of the deployment.
This is because labels are expected to be both meaningful and globally unique.
So if you `name` your contracts `ALICE` and `BOB`, and your deployment is called `20220706`,
the on-chain labels of the contracts will be `20220706/ALICE` and `20220706/BOB`.
:::

## How to deploy contracts

The `context.contract(name, Client?)` method, which returns a `ContractSlot` - a placeholder
representing a contract that might or might not already be deployed.

* `context.contract(name, Client?)` returns a `ContractSlot` - an object representing the role
  of a contract in a deployment. You can use it to deploy a contract, or get a contract that is
  already deployed. Either way, a `Client` is returned representing the deployed contract; you
  can pass a custom `Client` subclass as 2nd argument to `context.contract(...)` to get a client
  instance with your custom methods.
  * `await context.contract(name, Client?).getOrDeploy(source, init)` is the most handy method
    of `ContractSlot`: if a contract is found by `name` in the current deployment, it returns that;
    otherwise, it deploys `source` with the specified `init` message and auto-generated label.
  * `await context.contract(name, Client?).deploy(source, init)` deploys a contract from `source`
    with the specified `init` msg and an auto-generated label; but if a contract with the same
    label already exists on the chain, the call will fail.
  * `context.contract(name, Client?).get(message)` looks up a contract by `name` in the current
    deployment; if the contract is not found in the deployment, `message` is thrown.

:::info
`init` can be either an init message, or a function returned an init message.
This is useful when there is extra preparation needed when deploying a contract,
but not if it's already deployed.
:::

## Templates and factories

Sometimes you want to upload a contract to the chain, but not instantiate it. For example, one of
your contracts serves a factory and deploys new instances of another contract based on its id
and code hash. You can use the `context.template(source)` method. Similar to `context.contract`,
this returns a `TemplateSlot`; its methods are `get(message)`, `async upload()` and
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

## Deployments

:::info
The timestamp here corresponds to the moment the deployment was created, and not the moment
when a particular contract was deployed. You can get the latter by looking at `initTx` in the
deployment receipt, and querying that transaction in the transaction explorer.
:::

## The deploy procedure

So far, we've set up an environment for deploying contracts and keeping track of our
actions. Let's see how to implement the custom operation, `deployMyContract`, in that
environment.

## About operations and the operation context

Operations are asynchronous functions that take a single argument, the `OperationContext`,
and may return an object containing updates to the operation context.

You can extend the `OperationContext` type to add custom parameters to your operations.
The convention is to name the extended context after the function that will be using it.

```typescript
interface DeployMyContract extends OperationContext {
  param1: any
  param2: any
}

async function deployMyContract (context: DeployMyContract) {
  /* ... */
}
```

## Build for production

The first thing we need to do is compile a production build of our contract.
For this, we can use the `context.build(source: Source): Promise<Artifact>`
provided by `Fadroma.Build.Scrt`.

```typescript
async function deployMyContract (context: DeployMyContract) {
  const workspace = new Workspace(process.cwd())
  const source    = workspace.crate('my-contract')
  const artifact  = await context.build(source)
  /* ... */
}
```

The result of the build is stored under `artifacts/my-contract@HEAD.wasm`,
and a checksum is stored at `artifacts/my-contract@HEAD.wasm.sha256`, relative
to your project root.

### Upload the code

Now that we have a compiled artifact, we can use
`context.upload(artifact: Artifact): Promise<Template>`, provided by `Fadroma.Upload.FromFile`,
to upload the artifact to the chain selected by `Fadroma.Chain.FromEnv`,
resulting in a `Template` consisting of code ID and code hash.

```typescript
async function deployMyContract (context: DeployMyContract) {
  const workspace = new Workspace(process.cwd())
  const source    = workspace.crate('my-contract')
  const artifact  = await context.build(source)
  const template  = await context.upload(artifact)
  /* ... */
}
```

Since building code and uploading it to the blockchain go hand in hand,
the `context.buildAndUpload(source: Source): Promise<Tramplte>` function is
also present (provided both `Fadroma.Build.Scrt` and `Fadroma.Upload.FromFile` have been
invoked). This gives us a shorter way of uploading code to the chain:

```typescript
async function deployMyContract (context: DeployMyContract) {
  const source   = new Workspace(process.cwd()).crate('my-contract')
  const template = await context.buildAndUpload(source)
  /* ... */
}
```

### Instantiate the contract(s)

Now that we have a `Template`, we are ready to create as many instances
of our contract as needed.

```typescript
async function deployMyContract (context: DeployMyContract) {
  const source   = new Workspace(process.cwd()).crate('my-contract')
  const template = await context.buildAndUpload(source)
  const name     = "My Contract"
  const initMsg  = { param1: context.param1, param2: context.param2 }
  const instance = await context.deploy(template, name, initMsg)
  /* ... */
}
```

Invoking `npm run deploy new` will now deploy the contract to the chain
specified by `FADROMA_CHAIN`.

### Get a contract client

If we want to run further procedures after deployment, such as configuring our
smart contract, we could obtain an instance of the corresponding client class.

```typescript
import { MyContract } from 'my-client-library'
async function deployMyContract (context: DeployMyContract) {
  const source   = new Workspace(process.cwd()).crate('my-contract')
  const template = await context.buildAndUpload(source)
  const name     = "My Contract"
  const initMsg  = { param1: context.param1, param2: context.param2 }
  const instance = await context.deploy(template, name, initMsg)
  const client   = context.agent.getClient(MyContract, instance)
  await client.tx2("123")
}
```

Of course, this can also be written as a single expression:

```typescript
async function deployMyContract (context: DeployMyContract) {
  await context.agent.getClient(MyContract, await context.deploy(
    await context.buildAndUpload(new Workspace(process.cwd()).crate('my-contract')),
    "MyContract",
    { param1: context.param1, param2: context.param2 }
  )).tx2("123")
}
```

## Deployment idioms

### Stacking operations

Returning an object from an operation updates the context for subsequent steps.
Hence, the following is valid:

```typescript
async function deployMyContract (context: DeployMyContract) {
  const client = context.agent.getClient(MyContract, await context.deploy(
    await context.buildAndUpload(new Workspace(process.cwd()).crate('my-contract')),
    "MyContract",
    { param1: context.param1, param2: context.param2 }
  ))
  await client.tx2("123")
  return { myContract }
}

interface ConfigureMyContract extends OperationContext {
  myContract: MyContract
  myValue:    Uint128
}

async function configureMyContract (context: ConfigureMyContract) {
  await context.myContract.tx2(context.myValue)
}

Fadroma.command('deploy-and-configure',
  ...common,
  Fadroma.Deploy.New,
  deployMyContract,
  configureMyContract
)
```

### Working with an existing deployment

Let's say you already deployed your contract and want to configure it at a later time.
Use `Fadroma.Deploy.Append` to get the active deployment in `context`, and
`context.deployment.getClient(agent, Client, name)` to get a client for the
previously deployed contract.

```typescript
Fadroma.command('configure',
  ...common,
  Fadroma.Deploy.Append,
  function getMyContract (context) {
    return { myContract: context.deployment.getClient(context.agent, MyContract, "My Contract") }
  },
  configureMyContract
)
```

### Destructuring `context`

When an operation is reused in multiple contexts, you may find it useful to provide
overridable defaults for every member of `context` like so:

```typescript
Fadroma.command('configure',
  ...common,
  Fadroma.Deploy.Append,
  configureMyContract
)

function configureMyContract (context: ConfigureMyContract) {
  const {
    agent,
    deployment,
    name       = "My Contract",
    myContract = deployment.getClient(agent, MyContract, name)
    myValue    = "default config value"
  }
  await myContract.tx2(myValue)
}
```

### Adding static `init` method to client class

Client classes operate with contracts that are already instantiated: while `execute` and `query`
correspond to a contract's `handle` and `query`, the `init` method of the contract does **not**
correspond to the `constructor` of the client.

So, completely optionally, you could add a static `init` method on your client
like so:

```typescript
import { Client, Uint128, Address } from '@fadroma/client'

interface MyContractInit {
  param1: Uint128
  param2: Address
}

class MyContract extends Client {
  static init (param1: Uint128, param2: Address): MyContractInit {
    /* ...custom preparation, validation, etc... */
    return { param1, param2 }
  }
  /* ...tx and query methods... */
}
```

This would generate an init message, which you would then broadcast with `context.deploy`.
Alternatively, you could just generate the init message during
the deploy procedure, and not write a static `init` method.

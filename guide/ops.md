# Deploying and configuring smart contracts with Fadroma Ops

CosmWasm contract API consists of `init`, `handle`, and `query` methods,
but client classes only support calling `execute` (corresponding to `handle`) and
`query`.

So, who calls `init`? The **deployer** does. While there's nothing stopping you
from using Fadroma to deploy smart contracts from a browser environment,
the deployment of smart contracts is a workflow from their subsequent operation.

The following is a guide to understanding and using the smart contract deployment system,
Fadroma Ops.

## Preparation

### Add Fadroma and your script to `package.json`

```json
// /path/to/your/project/package.json
{
  "devDependencies": {
    "fadroma": "^100.0.0"
  },
  "scripts": {
    "deploy": "fadroma ./deploy.ts"
  }
}
```

:::info
Fadroma will use [Ganesha](https://github.com/hackbg/ganesha) to compile
deployment scripts on each run. You can use TypeScript seamlessly in your
deploy procedures.
:::

### Set up the deploy script

Here's a starter template for a deploy script:

```typescript
// /path/to/your/project/deploy.ts

import Fadroma, { Workspace } from '@hackbg/fadroma'
import type { OperationContext } from '@hackbg/fadroma'

const common = [
  Fadroma.Build.Scrt,
  Fadroma.Chain.FromEnv,
  Fadroma.Upload.FromFile,
]

Fadroma.command('new',
  ...common,
  Fadroma.Deploy.New,
  deployMyContract
)

Fadroma.command('add'
  ...common,
  Fadroma.Deploy.Append,
  deployMyContract
)

interface DeployMyContract extends OperationContext {
  param1: any
  param2: any
}

async function deployMyContract (context: DeployMyContract) {
  /* we'll implement the deployment procedure here */
}

// IMPORTANT: keep this line at the end of the file!
export default Fadroma.module(import.meta.url)
```

:::info
The structure of Fadroma deployment scripts has went through many changes during
development. This is how we currently write them, and it serves us well enough.
However, in future versions of Fadroma, we aim to simplify it further.
:::

This system is intended to allow mixing and matching of operations
for composing more complex deployments.

When working on a complex distributed system in an append-only environment,
the capability to define your operation procedures in smaller, composable steps,
is invaluable.

Let's break this down as we prepare to implement `deployMyContract`.

### Import Fadroma

The default export of Fadroma contains a collection of **operations**.
Those are functions that populate the **operation context** for performing
a deployment action.

```typescript
import Fadroma, { OperationContext } from '@hackbg/fadroma'
```

### Enable building and uploading

Since we may have multiple deploy commands, and all of them will need to be able to build and
upload contracts, we collect the pre-defined preparation steps in an array, `common`.

```typescript
const common = [
  Fadroma.Build.Scrt,
  Fadroma.Chain.FromEnv,
  Fadroma.Upload.FromFile,
]
```

The most common pre-defined operations are:
* `Fadroma.Build.Scrt`: subsequent steps will be able to `build` contracts for Secret Network
* `Fadroma.Chain.FromEnv`: subsequent steps will have access to the `chain` and `agent` defined
  by the `FADROMA_CHAIN` and `SCRT_AGENT_MNEMONIC` environment variables.
* `Fadroma.Upload.FromFile`: subsequent steps will be able to `upload` contracts to the selected
  `chain`.

`FADROMA_CHAIN` and supports the following values:

* `Mocknet`
* `LegacyScrtMainnet`, `LegacyScrtTestnet`, `LegacyScrtDevnet`
* `ScrtMainnet`, `ScrtTestnet`, `ScrtDevnet`

### Define commands

Up next are two `Fadroma.command(name, ...operations)` invocations. The `Fadroma.command` function
defines a command which is then exposed to the outside world by the final `Fadroma.module` call.

Having defined the `new` and `add` commands using:

```typescript
Fadroma.command('new', /*...*/)
Fadroma.command('add', /*...*/)
```

you will be able to invoke them with:

```shell
$ npm run deploy new
$ npm run deploy add
```

:::warning
**PNPM users:** PNPM after 7.4.0 introduces its own `deploy` command which is unrelated to
what we're doing here but shadows the `deploy` command defined in scripts. Make sure to run
`pnpm run deploy` and not `pnpm deploy`.
:::

### About deployment receipts

The `new` and `add` commands differ by one pre-defined step: `Fadroma.Deploy.New` vs
`Fadroma.Deploy.Append`. What's the difference?

```typescript
Fadroma.command('new', ...common, Fadroma.Deploy.New, deployMyContract)
Fadroma.command('add', ...common, Fadroma.Deploy.Append, deployMyContract)
```

Unless they're one-off things, smart contract projects are deployed in multiple stages.
You write some smart contracts, you deploy them on mainnet, then some time later
you've written the next part of the system and you want to link it to the previous one.

The **deployment receipt system** keeps track of the addresses, code ids, code hashes, and other
info about the smart contracts that you deployed, as YAML files under `receipts/$CHAIN_ID/$DATE.yml`.

* By adding `Fadroma.Deploy.New` to your command, you tell Fadroma to deploy contracts in a new,
  empty deployment, unrelated to previously deployed contracts, and store info about these contracts
  in a new receipt file.
* By adding `Fadroma.Deploy.Append` to your command, you tell Fadroma to deploy contracts in the
  currently active deployment, and store info about them in the existing receipt file.

It is recommended to keep receipts for mainnet and testnet in Git to keep track of the contracts
that you deploy to public networks.

The other thing that the deployments system does is prefix all contract labels with the name
of the deployment. Labels are expected to be both meaningful and globally unique, so if you name
your contracts `ALICE` and `BOB`, their actual labels will be e.g. `20220706_033003/ALICE` and
`20220706_033003/BOB`.

:::info
The timestamp here corresponds to the moment the deployment was created, and not the moment
when a particular contract was deployed. You can get the latter by looking at `initTx` in the
deployment receipt, and querying that transaction in the transaction explorer.
:::

## The deploy procedure

So far, we've set up an environment for deploying contracts and keeping track of our
actions. Let's see how to implement the custom operation, `deployMyContract`, in that
environment.

### About operations and the operation context

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

### Build for production

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

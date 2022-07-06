# Deploying and configuring smart contracts with Fadroma Ops

CosmWasm contract API consists of `init`, `handle`, and `query` methods,
but client classes only support calling `execute` (corresponding to `handle`) and
`query`.

So, who calls `init`? The **deployer** does. While there's nothing stopping you
from using Fadroma to deploy smart contracts from a browser environment,
the deployment of smart contracts is a workflow from their subsequent operation.

The following is a guide to understanding and using the smart contract deployment system,
Fadroma Ops.

## Add static `init` method to client class

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

It would only generate an init message, but not broadcast it.
Alternatively, you could just generate the init message during
the deploy procedure, and not write a static `init` method.

## Add Fadroma and your script to `package.json`

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
deploy procedures, which is really helpful when they start getting complex
in their own right.
:::

## Set up the deploy script

Here's what a deploy script could look like:

```typescript
// /path/to/your/project/deploy.ts

import Fadroma, { OperationContext } from '@hackbg/fadroma'

const common = [
  Fadroma.Build.Scrt,
  Fadroma.Chain.FromEnv,
  Fadroma.Upload.FromFile,
]

Fadroma.command('new',
  ...common,
  Fadroma.Deploy.New,
  deployContract
)

Fadroma.command('add'
  ...common,
  Fadroma.Deploy.Append,
  deployContract
)

interface DeployContract extends OperationContext {
  param1: any
  param2: any
}

async function deployContract (context: DeployContract) {
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

This system is intended to allow mixing and matching of deploy steps
for composing more complex deployments.

When working on a complex distributed system in an append-only environment,
the capability to define your operation procedures in smaller, composable steps,
is invaluable.

Let's break this down as we prepare to implement `deployContract`.

## Import Fadroma

The default export of Fadroma contains a collection of **deployment steps**.
Those are functions that populate the **operation context** for performing
a deployment action.

```typescript
import Fadroma, { OperationContext } from '@hackbg/fadroma'
```

Let's look at some pre-defined deployment steps; we'll see what's in `OperationContext`
when we get to implementing `deployContract`.

## Enable building and uploading

The most common deployment steps are `Fadroma.Build.Scrt`, `Fadroma.Chain.FromEnv`, and
`Fadroma.Upload.FromFile`.

Since we may have multiple deploy commands, and all of them will need to be able to build and
upload contracts, we collect these three steps in an array, `common`.

```typescript
const common = [
  Fadroma.Build.Scrt,
  Fadroma.Chain.FromEnv,
  Fadroma.Upload.FromFile,
]
```

Their names are more or less self-explanatory: they enable building smart contracts in a
Secret Network-specific build container, and uploading them to the Secret Network instance
(mainnet, testnet, devnet, or mocknet) that is specified by an environment variable.

The environment variable used by `Fadroma.Chain.FromEnv` is `FADROMA_CHAIN` and it supports
the following values:

* `Mocknet`
* `LegacyScrtMainnet`, `LegacyScrtTestnet`, `LegacyScrtDevnet`
* `ScrtMainnet`, `ScrtTestnet`, `ScrtDevnet`

## Define commands

Up next are two `Fadroma.command(name, ...steps)` invocations. The `Fadroma.command` function
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

### Deployment receipts

The `new` and `add` commands differ by one pre-defined step: `Fadroma.Deploy.New` vs
`Fadroma.Deploy.Append`. What's the difference?

```typescript
Fadroma.command('new', ...common, Fadroma.Deploy.New, deployContract)
Fadroma.command('add', ...common, Fadroma.Deploy.Append, deployContract)
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

## The actual deploy procedure

So far, we've set up an environment for deploying contracts and keeping track of our
actions. Let's see how to implement `deployContract` in that environment.

## Build for production

## Upload the code

## Instantiate the contract(s)

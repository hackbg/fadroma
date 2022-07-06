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

## Importing Fadroma

The default export of Fadroma contains a collection of **deployment steps**.
Those are functions that populate the **operation context** for performing
a deployment action.

```typescript
import Fadroma, { OperationContext } from '@hackbg/fadroma'
```

## Enabling build and upload actions

The most common deployment steps are `Fadroma.Build.Scrt`, `Fadroma.Chain.FromEnv`, and
`Fadroma.Upload.FromFile`.

Their names are more or less self-explanatory: they enable building smart contracts in a
Secret Network-specific build container, and uploading them to the Secret Network instance
(mainnet, testnet, devnet, or mocknet) that is specified by and environment variable.

Since we may have multiple deploy commands, and all of them will need to be able to build and
upload contracts, we collect these three steps in an array, `common`.

```typescript
const common = [
  Fadroma.Build.Scrt,
  Fadroma.Chain.FromEnv,
  Fadroma.Upload.FromFile,
]
```

## Defining commands

Up next are two `Fadroma.command(name, ...steps)` invocations. The `Fadroma.command` function
defines a command which is then exposed to the outside world by the final `Fadroma.module` call.
You can call the commands defined :

```shell
$ npm run deploy new
$ npm run deploy add
```

## Deployment receipts

## Building for production

## Deploying to mocknet

## Deploying to devnet

## Deploying to testnet and mainnet


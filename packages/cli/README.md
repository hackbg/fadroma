<div align="center">

<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# `@fadroma/cli` <br> ![](https://img.shields.io/badge/version-22.01-blueviolet?style=plastic)

**Fadroma supervises the lifecycle of a smart contract from source code to client.**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

</div>

<table><tr><td>

## Running commands in a project

**`Fadroma.command(`**

**`  command: string,`**

**`  ...stages: Function[]`**

**`)`** defines a **`Command`** as a match between:

* some **words** (represented by a space-separated string); and
* some **steps** (represented by async functions taking a single object argument)

</td><td>

```typescript
// do.ts
import Fadroma from '@hackbg/fadroma'

Fadroma.command('do something cat',
  Cat.init,
  async function meow ({ agent }) {
    // go wild here
  }
)

export default Fadroma.module(import.meta.url)
```

> See [`@hackbg/komandi`](https://github.com/hackbg/toolbox) for implementation.

</td></tr><tr><!--spacer--></tr><tr><td>

### The [`MigrationContext`](./Migrate.ts)

When invoking a **command** corresponding to a certain sequence
of **words** from the command line, the **steps** are executed
one after another, in a common environment.

This environment is represented in the [`MigrationContext`](https://github.com/hackbg/fadroma/blob/22.01/packages/ops/index.ts),
which is pre-populated with handles to the entities that
Fadroma provides for scripting smart contracts.

</td><td>

```typescript
type MigrationContext = {
  timestamp:   string
  chain:       Chain
  agent:       Agent
  uploadAgent: Agent
  deployAgent: Agent
  clientAgent: Agent
  deployment?: Deployment,
  prefix?:     string,
  suffix?:     string,
  cmdArgs:     string[]
  run <T extends object, U> (procedure: Function, args?: T): Promise<U>
}
```

> See [`Migrate.ts`](./Migrate.ts) for description of what these parameters do.

</td></tr><tr><!--spacer--></tr><tr><td>

### Extending the `MigrationContext`

Values returned by deploy steps are unconditionally
merged into the `MigrationContext` passed to subsequent
steps.

An example of this are the **`Deployment`** steps,
which populate the `deployment` and `prefix` keys
in the `MigrationContext`

</td><td>

```typescript
import Fadroma, { Deployment } from '@hackbg/fadroma'

Fadroma.command('deploy',
  Deployment.new,         // Start new deployment
  MyContract1.deployOne,  // Custom logic here
  MyContract2.deployAll,  // Custom logic here
  Deployment.status       // Print a list of contracts.
)

Fadroma.command('status', // Work in current deployment
  Deploy.current,
  CustomToken.status
)

Fadroma.command('select', // Let user select another deployment
  Deploy.select
)

export default Fadroma.module(import.meta.url)
```

> See also

</td></tr><tr><!--spacer--></tr><tr><td>

### Deploying and retrieving smart contracts

TODO: High level overview

</td><td>

TODO: This is what to do:

```
TODO: code sample
```

> TODO: See also

</td></tr></table>

## Example deployment script

> ...more or less...

```typescript
import Fadroma, { Deploy, Snip20 } from '@hackbg/fadroma'

class CustomToken extends Snip20 {

  name = 'CustomToken'

  /* Let's define some deploy steps. They're only `static`
   * because it's convenient. You can use free-standing
   * functions, too, and name them any way you like. */
  static async deploy ({
    /* In the context of every migration. */
    agent, chain,
    /* Provided by Deploy.new and Deploy.current */
    deployment, prefix,
  }) {

    /* Object representing the deployment info
     * for a particular contract. */
    const contract = new CustomToken()

    /* Builds and uploads are cached, so this one
     * only takes a long time the first time.
     * Delete files to rebuild/reupload. */
    await chain.buildAndUpload(agent, [
      contract,
      /* Add more contracts here to build them in parallel
       * and upload them as part of the same transaction. */])
    
    const initMsg = { /* Init the contract with this data */
      admin:   agent.address,
      name:    'Custom Token',
      symbol:  'CUSTOM',
      decimals: 18,
      config: { enable_mint: true },
    }

    await deployment.init(agent,
      [contract, initMsg],
      /* Add more contracts/initMsgs here to
       * instantiate multiple contracts in parallel */)

    /* Values returned by a step are added to the context. */
    return { contract }
  }

  static async status ({

    /* From migration context. */
    deployment, agent

    /* Taken from the previous step,
     * or from the deployment's receipts. */
    contract = new CustomToken(deployment.get('CustomToken'))

  }: Migration & { contract: CustomToken }) {

    /* Easily bundle multiple transactions, including inits.
     * You can't do a query in the middle of the bundle,
     * and the API is kinda rough. But it works, and
     * speeds up procedures considerably. */
    await agent.bundle().wrap(async bundle=>{
      const contract = token.client(bundle)
      await contract.setViewingKey("monkey")
      await contract.setMinters([agent.address])
      await contract.mint(agent.address, "1024")
    })

    /* Query and transaction methods for contracts are
     * defined separately from deployment procedures, in
     * the `Client` class. After deploying or retrieving
     * a `Contract` object, consider passing around only
     * `Client`s bound to particular `Agent`s. */
    const client = contract.client(agent)
    console.log(await client.balance(agent.address, "monkey"))

  }

}
```

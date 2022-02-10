# Fadroma CLI

## Running commands in a project

> See [`@hackbg/komandi`](https://github.com/hackbg/toolbox),

**`Fadroma.command(command: string, ...stages: Function[])`**
defines a command as a match between:

* some **words** (represented by a space-separated string); and
* some **stages** (represented by async functions taking a single object argument)

```typescript
// do.ts
import Fadroma from '@hackbg/fadroma'
Fadroma.command('do something cat',
  Cat.init,
  async function meow ({
    agent }) {
    // go wild here
  })
```

### The `MigrationContext`

When invoking the command, the steps are executed
in sequence, with a common state object -
the [`MigrationContext`](https://github.com/hackbg/fadroma/blob/22.01/packages/ops/index.ts).

This contains handles to the entities that Fadroma provides
for scripting smart contracts. It is up to you to define
suitable command content depending on your business logic.

The `MigrationContext` can be modified by individual **stages**,
by returning an object value from the stage;. The keys of the
object are then added into the context for subsequent steps.

> See [`Deployments.activate`](#needsdeployment)

### Example deployment script

> ...more or less...

```typescript
import Fadroma, { Deploy, Snip20 } from '@hackbg/fadroma'

Fadroma.command('deploy',
  Deploy.new,      /* Start new deployment */
  CustomToken.deploy,
  CustomToken.status)

Fadroma.command('status',
  Deploy.current, /* Activate current deployment */
  CustomToken.status)

Fadroma.command('select',
  Deploy.select) /* Let user select another deployment */

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

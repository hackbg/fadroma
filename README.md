<div align="center">

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

[![](/doc/logo.svg)](https://fadroma.tech)

**Industrial strength components and workflows for smart contract development in Rust.**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

Help yourselves to the [contribution guidelines](CONTRIBUTING.md).

[![Coverage Status](https://coveralls.io/repos/github/hackbg/fadroma/badge.svg?branch=22.01)](https://coveralls.io/github/hackbg/fadroma?branch=22.01)

</div>

<table>

<tr><td valign="top">

## Fadroma Ops

**Contract deployment workflow for Secret Network.**

Implemented in: [`@fadroma/ops`](./packages/ops) [`@fadroma/scrt`](./packages/scrt) [`@fadroma/scrt-1.0`](./packages/scrt-1.0) [`@fadroma/scrt-1.2`](./packages/scrt-1.2).

Just import `@hackbg/fadroma` to start scripting deployments and migrations.

* The `Contract` and `Client` classes represent smart contracts
  and allow you to write scripts that compile them, deploy them,
  and interact with them.
* The `Deployment` and `Migration` system helps you keep track
  of groups of connected contracts that work together.
* The `Agent`'s `Bundle` mode allows you to run multiple
  transactions simultaneously - including contract instantiations.
* Configuration file allows custom commands to be defined
  from reusable "deploy step" functions.
* Modular architecture, open to extension for other
  Cosmos-based blockchains.

</td><td>

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

Fadroma.command('deploy',
  Deploy.new,      /* Start new deployment */
  CustomToken.deploy,
  CustomToken.status)
Fadroma.command('status',
  Deploy.current, /* Activate current deployment */
  CustomToken.status)
Fadroma.command('select',
  Deploy.select) /* Let user select another deployment */
```

```sh
npx fadroma deploy new
npx fadroma deploy status
```

</td></tr>

<tr></tr>

<tr><td>

## Fadroma Derive

**Attribute macros for writing smart contracts.**

CosmWasm's raw syntax is a little verbose. We wrap all the repetitive bits
into familiar tags such as `#[init]`, `#[handle]` and `#[query]`.

* See [fadroma-derive-contract](./crates/fadroma-derive-contract)

</td><td></td>
</tr>

<tr></tr>

<tr><td>

## Fadroma Composability

**Composable contract traits.**

Replicate the same management functionality across your whole fleet of contracts,
by implementing it as a reusable Rust trait.

* See [fadroma-composability](./crates/fadroma-composability)

</td><td>
</td></tr>

</table>

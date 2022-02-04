<div align="center">

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

[![](/doc/logo.svg)](https://fadroma.tech)

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

Help yourselves to the [contribution guidelines](CONTRIBUTING.md).

[![Coverage Status](https://coveralls.io/repos/github/hackbg/fadroma/badge.svg?branch=22.01)](https://coveralls.io/github/hackbg/fadroma?branch=22.01)

</div>

<table>

<tr><td>

* **Contract deployment workflow for Secret Network.**

  Just import `@hackbg/fadroma` to start scripting deployments and migrations.
  * Implemented in in [@fadroma/ops](./packages/ops), [@fadroma/scrt](./packages/scrt),
    [@fadroma/scrt-1.0](./packages/scrt-1.0), and [@fadroma/scrt-1.2](./packages/scrt-1.2).
  * Open to extension for other blockchains supporting a similar deployment model.

</td><td>

```typescript
import Fadroma, { Deploy } from '@hackbg/fadroma'
import MyContract from './MyContract'

const name = 'MyContract1'

Fadroma.command('deploy new',
  Deploy.new,
  async ({ chain, agent, deployment }) => {
    const contract = new MyContract({ name })
    await chain.buildAndUpload(agent, [contract])
    await deployment.init(agent, contract, {
      my_init_message: 'goes_here'
    })
    await contract.tx(agent, { my_handle_message: 'goes here' })
  })

Fadroma.command('deploy status',
  Deploy.current,
  async ({ chain, agent, deployment }) => {
    const contract = deployment.getThe(name, new MyContract({ name }))
    console.log(await contract.query(agent, 'my_status_query'))
  })
```

</td></tr>

</table>

* **Attribute macros for writing smart contracts.**

  CosmWasm's raw syntax is a little verbose. We wrap all the repetitive bits
  into familiar tags such as `#[init]`, `#[handle]` and `#[query]`.
  * See [fadroma-derive-contract](./crates/fadroma-derive-contract)

* **Composable contract traits.**

  Replicate the same management functionality across your whole fleet of contracts,
  by implementing it as a reusable Rust trait.
  * See [fadroma-composability](./crates/fadroma-composability)

* **Smart API clients for smart contract interfaces, including SNIP20**

  Convert the JSON schema emitted by CosmWasm contracts into TypeScript types
  and use those to build rich TS/JS client APIs for your contracts.

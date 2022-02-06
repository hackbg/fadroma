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

Just import `@hackbg/fadroma` to start scripting deployments and migrations.

* [@fadroma/ops](./packages/ops)
* [@fadroma/scrt](./packages/scrt)
* [@fadroma/scrt-1.0](./packages/scrt-1.0)
* [@fadroma/scrt-1.2](./packages/scrt-1.2).
* Open to extension for other blockchains supporting a similar deployment model.

</td><td>

```typescript
import Fadroma, { Deploy, Snip20 } from '@hackbg/fadroma'

class CustomToken extends Snip20 {
  name = 'CUSTOM'
}

const name = 'Custom Token'

Fadroma.command('deploy new',
  Deploy.new,
  async ({ chain, agent, deployment }) => {
    const contract = new CustomToken({ name })
    await chain.buildAndUpload(agent, [contract])
    await deployment.init(agent, [contract, {
      admin:   agent.address,
      name:    'Custom Token',
      symbol:  'CUSTOM',
      decimals: 18,
      config: { enable_mint: true },
    }])
  })

Fadroma.command('deploy status',
  Deploy.current,
  async ({ chain, agent, deployment }) => {
    const token = new CustomToken(deployment.get(name))
    await agent.bundle().wrap(async bundle=>{
      const contract = token.client(bundle)
      await contract.setViewingKey("monkey")
      await contract.setMinters([agent.address])
      await contract.mint(agent.address, "1024")
    })
    console.log(await contract.balance(agent.address, "monkey"))
  })
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

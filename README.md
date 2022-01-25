<div align="center">

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

[![](/doc/logo.svg)](https://fadroma.tech)

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

Help yourselves to the [contribution guidelines](CONTRIBUTING.md).

[![Coverage Status](https://coveralls.io/repos/github/hackbg/fadroma/badge.svg?branch=refactor/crates)](https://coveralls.io/github/hackbg/fadroma?branch=refactor/crates)

</div>

* **Contract deployment workflow for Secret Network.**
  Just import `@hackbg/fadroma` to start scripting deployments and migrations.
  * Implemented in in [@fadroma/ops](./packages/ops), [@fadroma/scrt](./packages/scrt),
    [@fadroma/scrt-1.0](./packages/scrt-1.0), and [@fadroma/scrt-1.2](./packages/scrt-1.2).
  * Open to extension for other blockchains supporting a similar deployment model.

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

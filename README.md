<div align="center">

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

![](/doc/logo.svg)

Made with 💚  at [Hack.bg](https://hack.bg).

[![Coverage Status](https://coveralls.io/repos/github/hackbg/fadroma/badge.svg?branch=refactor/crates)](https://coveralls.io/github/hackbg/fadroma?branch=refactor/crates)

</div>

## Contents

### Rust

| Crate                                                         | Version | Purpose                                                      |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| [fadroma](./crates/fadroma)                                   | 21.12.0 | Reexports all the following crates:                          |
| [fadroma-auth](./crates/fadroma-auth)                         | 0.1.0   | Provides authentication primitives.                          |
| [fadroma-auth-proc](./crates/fadroma-auth-proc)               | 0.1.0   | Defines the `#[require_admin]` macro.                        |
| [fadroma-bind-js](./crates/fadroma-bind-js)                   | 0.1.0   | Allows contracts to be loaded in the browser.                |
| [fadroma-composability](./crates/fadroma-composability)       | 0.1.0   | Helpers for building contracts out of reusable Rust traits.  |
| [fadroma-declare-contract](./crates/fadroma-declare-contract) | 0.1.0   | Deprecated. Our first attempt at smoothing out the verbosity of the CW0.10 API. |
| [fadroma-derive-contract](./crates/fadroma-derive-contract)   | 0.1.0   | Provides the `#[init]`, `#[handle]` and `#[query]` macros.   |
| [fadroma-ensemble](./crates/fadroma-ensemble)                 | 0.1.0   | Enables multiple contracts to be tested in Rust.             |
| [fadroma-killswitch](./crates/fadroma-killswitch)             | 0.1.0   | Emergency pause and termination for smart contracts.         |
| [fadroma-math](./crates/fadroma-math)                         | 0.1.0   | 256-bit integers, SHA256 checksum, ChaCha RNG                |
| [fadroma-platform-scrt](./crates/fadroma-platform-scrt)       | 0.1.0   | Support for [Secret Network](https://scrt.network/), including inter-contract communication. |
| [fadroma-platform-terra](./crates/fadroma-platform-terra)     | TODO    | Support for [Terra](https://www.terra.money/)                |
| [fadroma-snip20-api](./crates/fadroma-snip20-api)             | 0.1.0   | Provides `ISNIP20` for talking to SNIP20 tokens              |
| [fadroma-snip20-impl](./crates/fadroma-snip20-impl)           | 0.1.0   | Reusable implementation of a SNIP20 token                    |
| [fadroma-storage](./crates/fadroma-storage)                   | 0.1.0   | Different ways of interacting with the storage APIs.         |

### TypeScript

| Package                                      | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| [ganesha](https://github.com/hackbg/ganesha) | Allows TypeScript to be used without an intermediate compilation step.  |
| [kabinet](./packages/kabinet)                | Class-based interface to the filesystem. Ops uses this to store config. |
| [komandi](./packages/komandi)                | Simple command line parser.                                             |
| [konzola](./packages/konzola)                | Console output formatter.                                               |
| [ops](./packages/ops)                        | Classes representing the CosmWasm build/upload/deploy workflow.         |
| [scrt](./packages/scrt)                      | Specialization of the `ops` classes for Secret Network                  |
| [scrt-1.0](./packages/scrt-1.0)              | Secret Network 1.0 support.                                             |
| [scrt-1.2](./packages/scrt-1.2)              | Secret Network 1.2 support.                                             |
| [tools](./packages/tools)                    | Various utilities.                                                      |

## Contributing to Fadroma

Please see the [contribution guidelines](CONTRIBUTING.md).

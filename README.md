# [Fadroma](https://fadroma.tech)

Industrial-strength tooling and components for WASM-based smart contracts.

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

![](/doc/logo.svg)

## Contents

Fadroma is Hack.bg's attempt to define and standardize unified development practices
targeting CosmWasm-based blockchains. Our primary focus has been Secret Network.

### Rust

| Crate                    | Purpose                                                      | Version |
| ------------------------ | ------------------------------------------------------------ | ------- |
| fadroma                  | Reexports all other crates.                                  | 21.12.0 |
| fadroma-auth             | Provides authentication primitives.                          | 0.1.0   |
| fadroma-auth-proc        | Defines the `#[require_admin]` macro.                        | 0.1.0   |
| fadroma-bind-js          | Allows contracts to be loaded in the browser.                | 0.1.0   |
| fadroma-composability    | Helpers for building contracts out of reusable Rust traits.  | 0.1.0   |
| fadroma-declare-contract | Deprecated. An attempt at a smart contract DSL.              | 0.1.0   |
| fadroma-derive-contract  | Provides the `#[init]`, `#[handle]` and `#[query]` macros.   | 0.1.0   |
| fadroma-ensemble         | Enables multiple contracts to be tested in Rust.             | 0.1.0   |
| fadroma-killswitch       | Emergency pause and termination for smart contracts.         | 0.1.0   |
| fadroma-math             | 256-bit integers, SHA256 checksum, ChaCha RNG                | 0.1.0   |
| fadroma-platform-scrt    | Support for [Secret Network](https://scrt.network/)          | 0.1.0   |
| fadroma-platform-terra   | Support for [Terra](https://www.terra.money/)                | TODO    |
| fadroma-snip20-api       | Provides `ISNIP20` for talking to SNIP20 tokens              | 0.1.0   |
| fadroma-snip20-impl      | Reusable implementation of a SNIP20 token                    | 0.1.0   |
| fadroma-storage          | Different ways of interacting with the storage APIs.         | 0.1.0   |

### TypeScript

| Package   | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| ganesha   | Allows TypeScript to be used without an intermediate compilation step.  |
| kabinet   | Class-based interface to the filesystem. Ops uses this to store config. |
| komandi   | Simple command line parser.                                             |
| konzola   | Console output formatter.                                               |
| ops       | Classes representing the CosmWasm build/upload/deploy workflow.         |
| scrt      | Specialization of the `ops` classes for Secret Network                  |
| scrt-1.0  | Secret Network 1.0 support.                                             |
| scrt-1.2  | Secret Network 1.2 support.                                             |
| tools     | Various utilities.                                                      |

## Contributing to Fadroma

Please see the [contribution guidelines](CONTRIBUTING.md).

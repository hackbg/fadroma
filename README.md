# [Fadroma](https://fadroma.tech)

Industrial-strength tooling and components for WASM-based smart contracts.

![](https://github.com/hackbg/fadroma/blob/21.08/doc/logo.svg)

## Features

In no particular order:

* Auto-generate typed contract APIs from JSON schema
* Build/upload/deploy contracts from TypeScript
* Builder pattern for response messages
* Composable admin authentication
* Composable contract core
* Composable snip20
* Contract links and callbacks
* Declare contract
* Derive contract
* Dispatch traits for handle/query message types
* Hash/checksum (SHA256)
* Humanize/Canonize traits 
* Patched SigningCosmWasmClient with async broadcast mode and retries
* Pseudorandom number generator (ChaCha)
* Storage helpers
* TODO: Terra support
* Uint256 and Decimal types
* Viewing key authentication

## Deploying smart contracts with Fadroma

## Contributing to Fadroma

Please see the [contribution guidelines](CONTRIBUTING.md).

## Contents

* `lib/` - Rust components. 
* `ops/` - Generic deployment code.
* `ops-scrt/` - SecretNetwork-specific deployment code
* `ops-scrt-1.0/`, `ops-scrt-1.2` - compatibility between holodeck-2/supernova-1
* `tools` - General JS utilities used across the library

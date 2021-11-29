# [Fadroma](https://fadroma.tech)

Industrial-strength tooling and components for WASM-based smart contracts.

![](https://github.com/hackbg/fadroma/blob/21.08/docs/logo.svg)

## Features

In no particular order:

* Smart contract scaffolding
  * Declare contract
  * Derive contract
  * Builder pattern for response messages
  * Dispatch traits for handle/query message types
* Deployment and operations:
  * Auto-generate typed contract APIs from JSON schema
  * Build/upload/deploy contracts from TypeScript
  * Patched SigningCosmWasmClient with async broadcast mode and retries
* Composable contract components:
  * Composable contract core
  * Composable admin authentication
  * Composable SNIP20 token implementation
* Math primitives:
  * `Uint256` and `Decimal` types
  * Hash/checksum (SHA256)
  * Pseudorandom number generator (ChaCha)
* Secret Network-specific:
  * Contract links and callbacks
  * Viewing key authentication
  * Humanize/Canonize traits 
  * Composable SNIP20 token implementation
  * SNIP20 client
  * Storage helpers
* TODO: Terra support

## Contributing to Fadroma

Please see the [contribution guidelines](CONTRIBUTING.md).

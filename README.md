# Fadroma

Fadroma is a blockchain client library and occasional development framework
maintained at [Hack.bg](https://hack.bg/).

Fadroma v3 is currently undergoing a [Deno](https://deno.land/)-first rebuild.
This enables interacting with [Tendermint](https://tendermint.com/)-compatible
chains from JavaScript and TypeScript in a more predictable way and with less
overhead than existing client libraries.

## Features

Some of the following were present in previous versions of Fadroma
and are in the process of being ported to the new implementation.

* Core:
  * Isomorphic: can run on server or client.
  * A `Chain` can be reached over multiple `Connection`s.
  * A script can use multiple independent `Agent` identities.

* Tendermint/CosmWasm:
  * Fetch blocks and results.
  * Fetch results of ABCI queries.
  * Partial clients for `Bank`, `Staking` and `Governance` APIs.
  * Describe fungible and non-fungible tokens.
  * Compile, upload, and instantiate contracts from source, binary, or code ID.
  * Query and transact with contracts by address and code hash.
  * Secret Network support.
  * Namada support with enhanced transaction data decoding.

* Solana
  * Programs
  * Program clients with Web3/Anchor
  * Program clients with Kit/Codama

* Bitcoin
  * Regtest setup
  * SimplicityHL

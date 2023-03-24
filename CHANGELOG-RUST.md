# Changelog - Fadroma Rust Crate

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

 - Unit struct and enum variants now supported by the `Canonize` derive macro ([3448523](https://github.com/hackbg/fadroma/commit/34485236ae5c2433fae35905bb59813178c748dc))
 - Fadroma DSL - procedural macro to reduce boilerplate and enable composing shared functionality or entire contracts ([#155](https://github.com/hackbg/fadroma/pull/155))
 - BREAKING ⚠️: Custom binary serialization for storage ([#147](https://github.com/hackbg/fadroma/pull/147)):
   - Introduces the `FadromaSerialize` and `FadromaDeserialize` traits which can be **derived** and are semantically equivalent to `serde`'s own `Serialize`/`Deserialize` traits.
   - All Fadroma storage types now use these traits.

### Changed
 - BREAKING ⚠️: The SNIP-20 implementation now uses Fadroma DSL. ([#159](https://github.com/hackbg/fadroma/pull/159))
 - BREAKING ⚠️: `scrt::pad_response` is now implemented as an extension to `cosmwasm_std::Response` via the `ResponseExt` trait. ([#159](https://github.com/hackbg/fadroma/pull/159))
 - BREAKING ⚠️: The killswitch module now only uses a single `ContractStatus` enum, consolidated from previously the `ContractStatusLevel` enum and `ContractStatus` struct ([#158](https://github.com/hackbg/fadroma/pull/158))
 - BREAKING ⚠️: The admin module now is a single implementation that covers both immediate and two-step admin changes ([#155](https://github.com/hackbg/fadroma/pull/155))
   - Now uses the new Fadroma DSL

 - BREAKING ⚠️: The killswitch module now uses Fadroma DSL ([#155](https://github.com/hackbg/fadroma/pull/155))

### Removed
    
 - BREAKING ⚠️: the contract derive procedural macro in favour of Fadroma DSL ([#155](https://github.com/hackbg/fadroma/pull/155))

## [0.7.0] - 2023-02-07

### Fixed

 - Removed `cosmwasm_std::to_binary` which resulted in double base64 the query result in the derive macro ([b932456](https://github.com/hackbg/fadroma/commit/b932456681eaa098e6d5ff6793e36fc53349f900))

## [0.6.1] - 2023-01-31
First official release on [crates.io](https://crates.io/crates/fadroma).

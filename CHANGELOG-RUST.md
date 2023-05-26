# Changelog - Fadroma Rust Crate

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
**with the exception** of the SNIP-20 token implementation.

## [Unreleased]

### Changed

 - BREAKING ⚠️: Introduced the `Address` and `MaybeAddress` marker traits to constrain the
 possible types for generic arguments as well as making it clear that an address is expected.
 ([#177](https://github.com/hackbg/fadroma/pull/177))

## [0.8.7] - 2023-05-12

### Changed

 - BREAKING ⚠️: Renamed the `impl_contract_harness!` macro to `contract_harness!`. It now also uses the same
 syntax as the `entrypoint!` macro and allows to optionally supply a reply entry point. ([#168](https://github.com/hackbg/fadroma/pull/168))
 - BREAKING ⚠️: Renamed `ContractInstantiationInfo` to `ContractCode`. ([#171](https://github.com/hackbg/fadroma/pull/171))

### Added

 - SNIP-25 allowance queries ([#169](https://github.com/hackbg/fadroma/pull/169))
 - Methods to get a random number (`next_u32/u64`) and to fill a slice with random bytes (`fill_bytes`) in `Prng` ([#170](https://github.com/hackbg/fadroma/pull/170))
 - SNIP-20 decoys ([#170](https://github.com/hackbg/fadroma/pull/170))
 - SNIP-20 support to deposit/redeem multiple native coin denominations ([#173](https://github.com/hackbg/fadroma/pull/173))
 - Convenience methods to create init and execute messages from `ContractCode` and `ContractLink` ([#171](https://github.com/hackbg/fadroma/pull/171))

## [0.8.6] - 2023-04-28

### Changed

 - BREAKING ⚠️: Addresses in the Ensemble are now checked if they are less than 55 bytes and all lower case characters.
 `MockEnv` will panic if this is not the case. The `sender` and `contract` fields are now private in order ensure this invariant.
 Use the getters if you need to read them. ([#166](https://github.com/hackbg/fadroma/pull/166))

## [0.8.5] - 2023-04-26

### Added

 - `Map` and `InsertOnlyMap` storage types ([#163](https://github.com/hackbg/fadroma/pull/163))
 - `set` method to `IterableStorage` ([#163](https://github.com/hackbg/fadroma/pull/163))
 - Convenience methods to `IterableStorage` to match the features of `SingleItem` and `ItemSpace` ([#163](https://github.com/hackbg/fadroma/pull/163))
 - `Addr` now implements `Segment` ([#163](https://github.com/hackbg/fadroma/pull/163))
 - `Namespace` types not also implement `Key` ([#163](https://github.com/hackbg/fadroma/pull/163))

### Changed

 - BREAKING ⚠️: Removed `_at` suffix from `IterableStorage` ([#163](https://github.com/hackbg/fadroma/pull/163))

## [0.8.0] - 2023-03-30

### Added

 - Unit struct and enum variants now supported by the `Canonize` derive macro ([3448523](https://github.com/hackbg/fadroma/commit/34485236ae5c2433fae35905bb59813178c748dc))
 - Fadroma DSL - procedural macro to reduce boilerplate and enable composing shared functionality or entire contracts ([#155](https://github.com/hackbg/fadroma/pull/155))
 - BREAKING ⚠️: Custom binary serialization for storage ([#147](https://github.com/hackbg/fadroma/pull/147)):
   - Introduces the `FadromaSerialize` and `FadromaDeserialize` traits which can be **derived** and are semantically equivalent to `serde`'s own `Serialize`/`Deserialize` traits.
   - All Fadroma storage types now use these traits.

### Changed

 - BREAKING ⚠️: `entrypoint!` macro now supports `reply` entry points and has a slightly different interface. ([d005e38](https://github.com/hackbg/fadroma/commit/d005e38711989578798d79e1997fcefdd18ce762))
 - BREAKING ⚠️: `Permit` struct: renamed `check_permission` -> `has_permission` and `check_contract` -> `is_for_contract`. ([693cbb0](https://github.com/hackbg/fadroma/commit/693cbb001c892194172d4af5eb1dd3f6a24895ec))
 - BREAKING ⚠️: The SNIP-20 implementation now uses Fadroma DSL. ([#159](https://github.com/hackbg/fadroma/pull/159))
 - BREAKING ⚠️: `scrt::pad_response` is now implemented as an extension to `cosmwasm_std::Response` via the `ResponseExt` trait. ([#159](https://github.com/hackbg/fadroma/pull/159))
 - BREAKING ⚠️: The killswitch module now only uses a single `ContractStatus` enum, consolidated from previously the `ContractStatusLevel` enum and `ContractStatus` struct ([#158](https://github.com/hackbg/fadroma/pull/158))
 - BREAKING ⚠️: The admin module now is a single implementation that covers both immediate and two-step admin changes ([#155](https://github.com/hackbg/fadroma/pull/155))
   - Now uses the new Fadroma DSL

 - BREAKING ⚠️: The killswitch module now uses Fadroma DSL ([#155](https://github.com/hackbg/fadroma/pull/155))

### Removed

 - BREAKING ⚠️: the `#[message]` procedural macro ([6e774a2](https://github.com/hackbg/fadroma/commit/6e774a2e500c2bd3d9326219feb48b1302639a5f))
 - BREAKING ⚠️: the contract derive procedural macro in favour of Fadroma DSL ([#155](https://github.com/hackbg/fadroma/pull/155))

## [0.7.0] - 2023-02-07

### Fixed

 - Removed `cosmwasm_std::to_binary` which resulted in double base64 the query result in the derive macro ([b932456](https://github.com/hackbg/fadroma/commit/b932456681eaa098e6d5ff6793e36fc53349f900))

## [0.6.1] - 2023-01-31
First official release on [crates.io](https://crates.io/crates/fadroma).

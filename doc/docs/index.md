
![](./logo.svg)

## Overview

[Fadroma](https://fadroma.tech) is a full-stack application framework
for the [CosmWasm](https://cosmwasm.com/) ecosystem.

This guide will show you how to set up a Fadroma project.

## The Rust part

[**Fadroma Engine**](https://fadroma.tech/rs/fadroma/index.html) is a collection of
Rust libraries for developing smart contracts.

Fadroma Engine includes [**Fadroma Derive**](https://fadroma.tech/rs/fadroma_proc_derive/index.html),
a collection of procedural macros for cleaner implementation of smart contract internals,
and [**Fadroma Ensemble**](https://fadroma.tech/rs/fadroma/ensemble/index.html), a library
for integration testing of multiple contracts, as well as a range of other useful bits and pieces.

## The TypeScript part

[**Fadroma Client**](https://fadroma.tech/js/modules/_fadroma_client.html) is a library for
interfacing with smart contracts from JavaScript or TypeScript.

Fadroma Client is leveraged by [**Fadroma Ops**](https://fadroma.tech/js/modules/_fadroma_ops.html),
a library for implementing your custom deployment and operations workflow - from local development
to mainnet deployment.

Fadroma Ops includes [**Fadroma Mocknet**](https://fadroma.tech/js/classes/_fadroma_ops.Mocknet.html),
a simulated environment for fast full-stack testing of your production builds.

# Fadroma Guide

[Fadroma](https://fadroma.tech) is a full-stack application framework
for the [CosmWasm](https://cosmwasm.com/) ecosystem.

This guide will show you how to set up a Fadroma project.

## Overview of Fadroma

### Fadroma Engine ("the Rust part")

[**Fadroma Engine**](https://fadroma.tech/rs/fadroma/index.html) is a collection of
rust libraries for developing smart contracts.

Fadroma Engine includes [**Fadroma Derive**](https://fadroma.tech/rs/fadroma_proc_derive/index.html),
a collection of procedural macros for cleaner implementation of smart contract internals.

Fadroma Engine also provides various reusable components.

### Fadroma Client ("the TypeScript part")

[**Fadroma Client**](https://fadroma.tech/js/modules/_fadroma_client.html) is a library for
interfacing with smart contracts from JavaScript or TypeScript.

Fadroma Client is leveraged by [**Fadroma Ops**](https://fadroma.tech/js/modules/_fadroma_ops.html),
a library for implementing your custom deployment and operations workflow - from local development
to mainnet deployment.

## Prerequisites

You'll need:

* **Linux or macOS.**
> WSL might also work but we haven't really tried.
>
> If you're using Fadroma on something more exotic, do get in touch and
> share your experience!

* **Git**, for keeping track of your changes.

* **Docker**, configured to run without `sudo`.
> Fadroma uses Docker to encapsulate builds and launch local devnets.

* **Node.js**, versions >= 16.12
> We prefer the PNPM package manager, because it has the most complete implementation of workspaces.

* **Rust**, stable or nightly.

* **Your preferred code editor.**
> We use NeoVim and VSCode.

## Creating a new project

## Writing smart contracts

### Writing a contract

### Writing a client class

## Deploying

### Writing a deploy procedure

### Deploying to mocknet

### Deploying to devnet

### Deploying to testnet and mainnet

## Interacting with your smart contract

### From a REPL

### From a script

### From a browser

### From a browser with Keplr

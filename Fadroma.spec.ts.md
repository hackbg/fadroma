# The Fadroma Agent & Ops Guide

Welcome to the Fadroma Ops Guide!

This collection of documents doubles (triples!) as documentation, specification,
and test suite. We hope that by reading it you become familiar with both *what*
Fadroma Ops can do, and *how* it does it.

If you clone the Fadroma repo, you can use `pnpm test` to run the tests,
and `pnpm test:cov` or `pnpm test:lcov` to generate a test coverage report. Happy hacking!

## Design and goals of Fadroma Agent & Fadroma Ops

Fadroma is a framework for building decentralized application backends
out of smart contracts deployed to blockchains.

We take the approach of viewing the blockchain as a **distributed VM**:
the platform abstracts over details such as provisioning servers or keeping state in sync,
and the application developer doesn't need to concern oneself with them.

In this model, smart contracts are considered as similar to **persistent objects**:
each one scoped to a specific task, and interoperating with others to make up a system,
exposing and API and encapsulating state.

Unlike the microservices model, such a globally distributed WebAssembly runtime
would largely shield implementors from the bulk of the accumulated POSIX heritage,
instead exposing a **seamless compute substrate** as a simple API 
(the init/handle/query of the CosmWasm actor model, and the associated get/set
of the key-value store), backed by a gas metric representing the cost of the resources used.

This model necessitates a novel approach to orchestrating the deployment and operation
of the software, to ensure its interoperation with the existing Web ecosystem
and development workflows. This is the ground that Fadroma sets out to cover
in the TypeScript realm.

## Obtaining Fadroma

Fadroma is available as a suite of Cargo crates and NPM packages.

If you have Nix, a standard development environment (containing Rust and Node.js)
can be entered using:

```sh
$ nix-shell https://advanced.fadroma.tech
```

If you have Rust and Node.js already set up on your development machine,
you can create a new Fadroma project using:

```sh
$ npx fadroma project create
```

Alternatively, you can add Fadroma to an existing NPM project using:

```sh
$ npm i --save fadroma
```

## Using Fadroma from the command line

The core features of Fadroma are invoked using the command-line tool, `fadroma`.

```sh
$ fadroma contract add my-contract
$ fadroma build my-contract
$ fadroma upload my-contract
$ fadroma init my-contract
$ fadroma query my-contract "{...}"
$ fadroma tx my-contract "{...}"
```

## Scripting Fadroma

For more complex operations, you can define custom commands, which you implement in TypeScript
using the Fadroma TypeScript API. **See [@fadroma/core](packages/core/Core.spec.ts.md)** to get
started with scripting Fadroma.

## [Deploying and managing contracts](./spec/DeployingContracts.ts.md)

The second layer of the Fadroma Ops model consists of the `Deployment`, `DeployStore`,
`Contract`, `ContractTemplate`, and `ContractGroup` classes. These allow you to describe
services built out of multiple interconnected contracts, and deploy them from source onto
a blockchain backend of your choosing. By subclassing `Deployment`, and using its methods to define
the roles of individual smart contracts, you are able do this in a declarative, idempotent, and
reproducible way.

* **Explore the [deployment guide](./spec/DeployingContracts.ts.md)**
* One commonly used type of contract is a **custom token**. Fadroma Ops provides
  a deployment API for [managing native and custom tokens](./spec/Tokens.ts.md).
* The procedures for compiling contracts from source and uploading them to the chain,
  and for caching the results of those operations so you don't have to do them repeatedly,
  are implemented in the [`Builder` and `Uploader` classes](./spec/BuildingAndUploading.ts.md).

```typescript
context.command(
  'deploy', 'test connection and transaction primitives', async () => {
    await import('./spec/DeployingContracts')
  }
)
context.command(
  'tokens', 'test token management APIs', async () => {
    await import('./spec/Tokens')
  }
)
```

## Test entrypoints

```typescript
export default new CommandContext()
import { CommandContext } from '@hackbg/cmds'
const context = new CommandContext()
context.command('all', 'run all tests', async () => {
  await import('./spec/Metadata.ts.md')
  await import('./spec/Logging.ts.md')
  await import('./spec/Errors.ts.md')
  await import('./spec/ConnectingAndTransacting.ts.md')
  await import('./spec/BuildingAndUploading.ts.md')
  await import('./spec/DeployingContracts.ts.md')
  await import('./spec/Devnet.ts.md')
  await import('./spec/Mocknet.ts.md')
  await import('./spec/Tokens.ts.md')
})
```

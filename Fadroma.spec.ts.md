# The Fadroma Ops Guide

Welcome to the Fadroma Ops Guide! This collection of documents doubles (triples!)
as documentation, specification, and test suite. We hope that by reading it
you become familiar with both *what* Fadroma Ops can do, and *how* it does it.

If you clone the Fadroma repo, you can use `pnpm ts:test` to run the tests,
and `pnpm ts:test:cov` or `pnpm ts:test:lcov` to generate a test coverage report. Happy hacking!

## What is Fadroma Ops

Fadroma Ops is a framework for building decentralized application backends
out of smart contracts deployed to blockchains.

We take the approach of viewing the blockchain as a **distributed VM**:
the platform abstracts over details such as provisioning servers or keeping state in sync,
and the application developer doesn't need to care about them. In this model,
**smart contracts are largely equivalent to microservices**: each one is scoped to a
specific task, and they interoperate with each other to make up a system.

The main architectural differences that power this kind of distributed,
consensus-based computation are as follows:

* **The blockchain is append-only** (there's no way to revert to an earlier state)
* **Usage is metered per VM instruction rather than per minute** (to change state, pay gas fees)
* **The platform API is comparatively tiny** (unlike POSIX-based microservices)

As a rough analogy, a blockchain-based application backend would look more like
[9P](https://en.wikipedia.org/wiki/9P_(protocol), and less like [Kubernetes](https://en.wikipedia.org/wiki/Kubernetes).
These novel constraints necessitate a novel approach to orchestrating the deployment
and operation of the software. This is what Fadroma Ops sets out to provide.

## Command-line entrypoints

Currently, the main way of interacting with Fadroma is using a combination
of scripting and terminal commands. You describe how to deploy, test, migrate, etc.
using the Fadroma Ops API, then you bind the entrypoints of the script to CLI invocation
using the `@hackbg/cmds` library, which looks like this:

```typescript
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

## [Connecting and transacting](./spec/ConnectingAndTransacting.ts.md)

The first layer of the Fadroma Ops model consists of the `Chain`, `Agent`, and `Bundle` classes.
They provide APIs that have to do with the basic building blocks of on-chain activity:
identities (wallets) and transactions (sending tokens, calling contracts, batching transactions,
specifying gas fees, etc).

* **Explore the [connecting and transacting guide](./spec/ConnectingAndTransacting)**
* To enable faster development and local full-stack testing, Fadroma Ops implements the
  [**Devnet**](./spec/Devnet.ts.md) (isolated local chain) and
  [**Mocknet**](./spec/Mocknet.ts.md) (fast simulated chain).

```typescript
context.command(
  'connect', 'test connection and transaction primitives', async () => {
    await import('./spec/ConnectingAndTransacting.ts.md')
  }
)
context.command(
  'devnet', 'test devnet', async () => {
    await import('./spec/Devnet.ts.md')
  }
)
context.command(
  'mocknet', 'test mocknets', async () => {
    await import('./spec/Mocknet.ts.md')
  }
)
```

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

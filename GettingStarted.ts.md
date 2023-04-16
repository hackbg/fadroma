# Getting started

**Fadroma** is an application framework targeting the CosmWasm Compute module.
Fadroma includes **Rust** libraries for writing smart contracts and a
**TypeScript** system for building, deploying, and interacting with them.

## Design considerations

Fadroma treats the blockchain as a **seamless compute substrate**,
and treating the contracts as similar to **persistent objects** -
somewhat similar to Alan Kay's original concept of
"object-oriented programming".

Unlike **microservices**, smart contracts exist in a post-POSIX environment,
where platform details are abstracted away; unlike **cloud functions**,
smart contracts are individually stateful. Furthermore, the
**transaction-based architecture** prevents the system from
spontaneously entering inconsistent states.

This model necessitates a systematic approach to orchestrating the deployment and operation
of the software, to ensure its interoperation with the existing Web ecosystem
and development workflows. This is ground that Fadroma sets out to cover.

Fadroma is available as a suite of Cargo crates and NPM packages.

## Project structure

The default structure of a project is implemented by the
[**`@fadroma/project`**](./packages/project/Project.spec.ts.md) package.
Projects created by Fadroma are polyglot Rust/TypeScript repositories.

* The Rust side can be structured either as a Cargo workspace
  (implementing each contract as a separate crate) or as a
  single Cargo crate (exposing different contracts from the
  same crate, based on compile-time feature flags).

* The TypeScript side is structured as a PNPM workspace, with a private
  top-level package (for dev-only dependencies), and two subpackages,
  `api` (client API) and `ops` (deployment and migration scripts).

### Create a Fadroma project through NPX

If you have Node.js set up, you can use the `npx` command to create a new Fadroma project:

```sh
$ npx @hackbg/fadroma@latest fadroma project create
```

This will install the latest version of the `@hackbg/fadroma` package,
and run the `fadroma project create` command, which will create a new project.

### Add more contracts

When creating a project, you will be able to create contracts.

Afterwards, you can add new contracts to your project with:

```sh
$ npm exec fadroma contract add [NAME...]
```

## Writing contracts

A contract is your basic unit of domain logic.
They are very much like persistent objects
that communicate with each other, and
respond to the outside world,
via message passing.

### Macro DSL

[**Fadroma DSL**](https://docs.rs/fadroma-dsl/latest/fadroma-dsl)
is a family of procedural macros for clean, boilerplate-free implementation
of smart contract internals,

### Libraries

[**Fadroma**](https://docs.rs/fadroma/latest/fadroma) libraries.

### Build CLI

Having written a contract, you need to compile it and instantiate it on a chain.

To build the entire project:

```sh
$ npm exec fadroma build
```

To build specific contracts:

```sh
$ npm exec fadroma build CONTRACT
```

The build commands are implemented by the
[**`@fadroma/ops`**](./packages/build/Build.spec.ts.md) package.

## Deploying contracts

### Deploy CLI

To instantiate a contract:

```sh
$ npm exec fadroma init CONTRACT LABEL INITMSG
```

To query or transact:

```sh
$ npm exec fadroma q LABEL MSG
$ npm exec fadroma tx LABEL MSG
```

The deployment commands are implemented by the
[**`@fadroma/ops`**](./packages/build/Build.spec.ts.md) package.

### Devnets

By default, Fadroma deploys to a **devnet**: a local instance of
a blockchain, running in a Docker or Podman container.

## Testing contracts

### Testing with Ensemble

[**Fadroma Ensemble**](https://fadroma.tech/rs/fadroma/ensemble/index.html)
is a library for for integration testing of multiple contracts.

### Testing with Mocknet

[**Fadroma Mocknet**](https://fadroma.tech/js/classes/_fadroma_ops.Mocknet.html) is
a simulated environment for fast full-stack testing of your production builds.

## Scripting Fadroma

For more complex operations, you can define custom commands, which you implement in TypeScript
using the Fadroma TypeScript API. **See [@fadroma/agent](agent/Core.spec.ts.md)** to get
started with scripting Fadroma.

To run a Fadroma script in your project:

```sh
$ fadroma run script.js
```

### TypeScript

Fadroma will use [Ganesha](https://github.com/hackbg/ganesha) to compile
deployment scripts on each run. You can use TypeScript seamlessly in your
deploy procedures.

```sh
$ fadroma run script.ts
```

### Agent API

[**Fadroma Core**](https://fadroma.tech/js/modules/_fadroma_client.html) is a library for
interfacing with smart contracts from JavaScript or TypeScript.

To get started with writing Fadroma scripts,
proceed to the [***Fadroma Core API Specification***](./packages/core/Core.spec.ts.md).

### Deployment API

### Connecting

The [**Fadroma Connect**](./packages/connect/Connect.spec.ts.md) library
serves as an index of all supported connection targets.

#### Secret Network

The [**`@fadroma/scrt`**](./platforms/scrt/Scrt.spec.ts.md)
package implements support for Secret Network.

#### Other Cosmos-like chains

Planned. See [issue #148](https://github.com/hackbg/fadroma/issues/148).

#### EVM-based chains

Under consideration.

## Nix environment support

Nix is a functional package manager. Fadroma can optionally
use Nix to provide you with a stable development environment.

### Standalone Nix shell

If you have Nix, you can enter a Fadroma shell with:

```sh
$ nix-shell https://fadroma.tech/nix
```

Nix will download tools like Node, Rust, Fadroma, etc.,
and will drop you in a shell where these tools are available
on the system path. In this shell, you can able to invoke
the Fadroma CLI with just `fadroma` instead of `npm exec fadroma` or similar.

### Create a Fadroma project through Nix

If you use Nix, you can create a project with:

```sh
$ nix-shell https://fadroma.tech/nix -c fadroma project create
```

### Project-specific Nix shell

Projects are created with a `shell.nix`, which you can enter with:

```sh
$ cd /my/project
$ nix-shell
```

Or, from any other directory:

```sh
$ nix-shell /my/project/shell.nix
```

---

```typescript
import './agent/Core.spec.ts.md'

import './connect/Connect.spec.ts.md'
import './platforms/scrt/Scrt.spec.ts.md'
import './platforms/cw/CW.spec.ts.md'
import './platforms/evm/EVM.spec.ts.md'

import './ops/Ops.spec.ts.md'
```

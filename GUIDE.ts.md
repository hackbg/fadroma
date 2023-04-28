# Getting started

**Fadroma** is an application framework targeting the CosmWasm Compute module.
Fadroma includes **Rust** libraries for writing smart contracts and a
**TypeScript** system for building, deploying, and interacting with them.

## Design considerations

On the most abstract level, Fadroma treats the blockchain as a **seamless compute substrate**,
and contracts basically as **persistent objects**.

* Unlike **microservices**, smart contracts exist in a post-POSIX environment,
  where platform details are abstracted away.

* Unlike **cloud functions**, smart contracts are individually stateful.

Furthermore, the **transaction-based architecture** prevents the system from
spontaneously entering inconsistent states. This makes CosmWasm smart contracts
a very interesting proposition for running standalone business logic.

## Project structure

The default structure of a project is implemented by the
[**`Project`** class](./spec/Project.spec.ts.md).
Projects created by Fadroma are polyglot Rust/TypeScript repositories.

* The Rust side is structured as a Cargo workspace,
  where each contract corresponds to a crate.

* The TypeScript side is structured as single NPM package,
  which exports an `api.ts` module (the client library for your project),
  and also contains an `ops.ts` module (where your project, and any custom
  extensions to the workflow, are defined).

### Create a Fadroma project through NPX

If you have Node.js set up, you can use the `npx` command to create a new Fadroma project:

```sh
$ npx @hackbg/fadroma@latest create
```

This will download the latest version of the `@hackbg/fadroma` package,
and run the `fadroma create` command from it, which will create a new project.

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
[**`@fadroma/ops`**](./spec/Build.spec.ts.md) package.

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
[**`@fadroma/ops`**](./spec/Build.spec.ts.md) package.

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
using the Fadroma TypeScript API. **See [@fadroma/agent](./spec/Agent.spec.ts.md)** to get
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
proceed to the [***Fadroma Core API Specification***](./spec/Agent.spec.ts.md).

### Deployment API

### Connecting

The [**Fadroma Connect**](./spec/Connect.spec.ts.md) library
serves as an index of all supported connection targets.

#### Secret Network

The [**`@fadroma/scrt`**](./spec/Scrt.spec.ts.md)
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
import './spec/Agent.spec.ts.md'
import './spec/Mocknet.spec.ts.md'
import './spec/Connect.spec.ts.md'
import './spec/Scrt.spec.ts.md'
import './spec/Ops.spec.ts.md'
```

# Getting started

**Fadroma** is an application framework targeting the CosmWasm Compute module.
Fadroma includes **Rust** libraries for writing smart contracts and a
**TypeScript** system for building, deploying, and interacting with them.

## Creating a project with NPM

If you have Node.js set up, you can use `npm init` to create a new Fadroma project:

```sh
$ npx @hackbg/fadroma@latest fadroma project create
```

This will install the latest version of the `@hackbg/fadroma` package,
and run the `fadroma project create` command, which will create a new project.

## Nix support

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

### Creating a project with Nix

If you use Nix, you can create a project with:

```sh
$ nix-shell https://fadroma.tech/nix -c fadroma project create
```

### Project Nix shell

Projects are created with a `shell.nix`, which you can enter with:

```sh
$ cd /my/project
$ nix-shell
```

Or, from any other directory:

```sh
$ nix-shell /my/project
```

## Defining contracts

### Adding contracts to the project

When creating a project, you will be able to create contracts.

Afterwards, you can add new contracts to your project with:

```sh
$ npm exec fadroma contract add [NAME...]
```

### fadroma-dsl

[**Fadroma DSL**](https://docs.rs/fadroma-dsl/latest/fadroma-dsl)
is a family of procedural macros for clean, boilerplate-free implementation
of smart contract internals,

### fadroma::*

[**Fadroma**](https://docs.rs/fadroma/latest/fadroma) libraries.

## Building and deploying

### @fadroma/project

```typescript
import './packages/project/Project.spec.ts.md'
```

### @fadroma/build

To build the entire project:

```sh
$ npm exec fadroma build
```

To build specific contracts:

```sh
$ npm exec fadroma build CONTRACT
```

```typescript
import './packages/build/Build.spec.ts.md'
```

### @fadroma/deploy

[**Fadroma Deploy**](https://fadroma.tech/js/modules/_fadroma_ops.html) is
a library for implementing your custom deployment and operations workflow - from local development
to mainnet deployment.

```typescript
import './packages/deploy/Deploy.spec.ts.md'
```

To instantiate a contract:

```sh
$ npm exec fadroma --devnet init CONTRACT LABEL INITMSG
```

To query or transact:

```sh
$ npm exec fadroma --devnet q LABEL MSG
$ npm exec fadroma --devnet tx LABEL MSG
```

### @fadroma/devnet

```typescript
import './packages/devnet/Devnet.spec.ts.md'
```

## Scripting

### @fadroma/core

[**Fadroma Core**](https://fadroma.tech/js/modules/_fadroma_client.html) is a library for
interfacing with smart contracts from JavaScript or TypeScript.

```typescript
import './packages/core/Core.spec.ts.md'
```

### @fadroma/connect

```typescript
import './packages/connect/Connect.spec.ts.md'
```

#### @fadroma/scrt

```typescript
import './platforms/scrt/Scrt.spec.ts.md'
```

#### @fadroma/cw

```typescript
import './platforms/cw/CW.spec.ts.md'
```

#### @fadroma/evm

```typescript
import './platforms/evm/EVM.spec.ts.md'
```

## Automated testing

### fadroma::ensemble

[**Fadroma Ensemble**](https://fadroma.tech/rs/fadroma/ensemble/index.html)
is a library for for integration testing of multiple contracts.

### @fadroma/mocknet

[**Fadroma Mocknet**](https://fadroma.tech/js/classes/_fadroma_ops.Mocknet.html) is
a simulated environment for fast full-stack testing of your production builds.

```typescript
import './packages/mocknet/Mocknet.spec.ts.md'
```


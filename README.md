[![Fadroma](./homepage/logo.svg)](https://fadroma.tech)

**Fadroma** is an application framework targeting the CosmWasm Compute module.
Fadroma includes **Rust** libraries for writing smart contracts and a
**TypeScript** system for building, deploying, and interacting with them.

[![Latest version](https://img.shields.io/crates/v/fadroma.svg?color=%2365b34c&style=for-the-badge)](https://crates.io/crates/fadroma)
[![Documentation](https://img.shields.io/docsrs/fadroma/latest?color=%2365b34c&style=for-the-badge)](https://docs.rs/fadroma)
[![](https://img.shields.io/npm/v/@fadroma/core?color=%2365b34c&label=%40fadroma%2Fcore&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/core)
[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

* [**Fadroma Engine**](https://fadroma.tech/rs/fadroma/index.html) is a collection of
  Rust libraries for developing smart contracts.
* [**Fadroma DSL**](https://fadroma.tech/rs/fadroma_proc_derive/index.html)
  is a family of procedural macros for clean, boilerplate-free implementation
  of smart contract internals,
* [**Fadroma Ensemble**](https://fadroma.tech/rs/fadroma/ensemble/index.html)
  is a library for for integration testing of multiple contracts.
* [**Fadroma Client**](https://fadroma.tech/js/modules/_fadroma_client.html) is a library for
  interfacing with smart contracts from JavaScript or TypeScript.
* [**Fadroma Ops**](https://fadroma.tech/js/modules/_fadroma_ops.html) is
  a library for implementing your custom deployment and operations workflow - from local development
  to mainnet deployment.
* [**Fadroma Mocknet**](https://fadroma.tech/js/classes/_fadroma_ops.Mocknet.html) is
  a simulated environment for fast full-stack testing of your production builds.

## Creating a project

### Creating a Fadroma project with NPM

If you have Node.js set up, you can use `npm init` to create a new Fadroma project:

```sh
$ npm init @fadroma
```

This will run the `fadroma project create` command,
which will ask you a few questions and create a mixed NPM/Cargo project.

### Creating a Fadroma project with Nix

If you use Nix, you can create a project with:

```sh
$ nix-shell https://fadroma.tech/nix -c fadroma project create
```

Projects are created with a `shell.nix` which you can enter with:

```sh
$ nix-shell /my/project
```

Or, if you're already at the root of the project:

```sh
$ nix-shell
```

## Standalone Nix shell

```sh
$ nix-shell https://fadroma.tech/nix
```

This contains Node, Rust, build utilities,
and a `fadroma` command in the `PATH`.

## Exploring onward

Now you are ready to write your first smart contract, deploy it,
and integrate it with the wider Internet-of-Blockchains.

---

```
"The reasonable man adapts himself to the world;
 the unreasonable one persists in trying to adapt the world to himself.
 Therefore, all progress depends on the unreasonable man."
                                    - Marvin Heemeyer
```

---

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

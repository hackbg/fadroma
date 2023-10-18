# Getting started

**Fadroma** is an application framework for the CosmWasm Compute module.
Fadroma includes **Rust** libraries for writing smart contracts and a
**TypeScript** system for building, deploying, and interacting with them.

Our operational model treats the blockchain as a **seamless compute substrate**,
and contracts as akin to **persistent objects**.

* Unlike **microservices**, smart contracts exist in a "post-POSIX"
  environment, where platform details are abstracted away. Contracts
  are Internet-native, but shed most of the baggage characteristic for
  Web 2.0 backends. Therefore interoperation with Web 2.0 systems can be non-trivial.

* Unlike **cloud functions**, smart contracts are individually stateful,
  and exist permanently on an append-only ledger. While the
  **distributed transaction-based architecture** guards the system's state from
  spontaneous inconsistencies, extra care must be taken in orchestrating deployments
  and migrations.

The above properties make CosmWasm smart contracts a very interesting proposition
for running standalone business logic with programmable privacy/transparency properties.
Fadroma provides the orchestration system for leveraging the full capabilities of
smart contract-based systems over the entire development lifecycle.

## Supported platforms

[The **`@fadroma/connect`** package](./connect.html) library
serves as an index of all supported connection targets.

### Secret Network

[The **`@fadroma/scrt`** package](./scrt.html)
package implements support for Secret Network.

### Other CosmWasm chains

Planned. See [issue #148](https://github.com/hackbg/fadroma/issues/148).

### Non-CosmWasm chains

Under consideration.

## Project structure

The default structure of a project is implemented by the
[**`Project`** class](project.html).
Projects created by Fadroma are polyglot Rust/TypeScript repositories.

* The Rust side is structured as a Cargo workspace,
  where each contract corresponds to a crate.

* The TypeScript side is structured as single NPM package,
  which exports an `api.ts` module (the client library for your project),
  and also contains an `ops.ts` module (where your project, and any custom
  extensions to the workflow, are defined).

See [the **Fadroma Project** Guide](project.html) for more info.

### Create project with NPX

If you have Node.js set up, you can use the `npx` command to create a new Fadroma project:

```sh
$ npx @hackbg/fadroma@latest create
```

This will download the latest version of the `@hackbg/fadroma` package,
and run the `fadroma create` command from it, which will create a new project
using an interactive console-based wizard.

When creating a project, you will be able to define an initial set of contracts.

### Nix support

Nix is a functional package manager. Fadroma can optionally
use Nix to provide you with a stable development environment.

If you use Nix, you can create a project with:

```sh
$ nix-shell https://fadroma.tech/nix -c fadroma create
```

A temporary Fadroma shell can be entered with with:

```sh
$ nix-shell https://fadroma.tech/nix
```

The project wizard creates Fadroma projects with a default `shell.nix`.
From the project's root directory, you can enter the project's Nix shell
with just:

```sh
$ nix-shell
```

Or, from any other directory:

```sh
$ nix-shell /my/project/shell.nix
```

Nix will download tools like Node, Rust, Fadroma, etc., and will start a
new shell session in an environment where these tools are available globally.

## Writing smart contracts

A contract is your basic unit of domain logic.
They are very much like persistent objects
that communicate with each other, and
respond to the outside world,
via message passing.

### Macro DSL

[The **`fadroma-dsl`** crate](https://docs.rs/fadroma-dsl/latest/fadroma_dsl)
implements a family of procedural macros for clean, boilerplate-free implementation
of smart contract internals,

### Libraries

[The **`fadroma`** crate](https://docs.rs/fadroma/latest/fadroma) contains
a set of libraries for writing smart contracts.

### Building

Having written a contract, you need to compile it and instantiate it on a chain.

To build the entire project:

```sh
$ npm exec fadroma build
```

To build specific contracts:

```sh
$ npm exec fadroma build CONTRACT [CONTRACT...]
```

In the above invocation, `CONTRACT` corresponds to a key of `templates` in
the project's `fadroma.json`.

[The **Fadroma Build Guide**](build.html) contains more info on configuring builds.

### Testing with Ensemble

[**Fadroma Ensemble**](https://docs.rs/fadroma/latest/fadroma/ensemble/index.html)
is a library for for integration testing of multiple contracts.

## Deploying and scripting

### Deploy CLI

The `fadroma deploy` command deploys the current project:

```sh
$ npm exec fadroma deploy
```

Note: the above will fail if the `FADROMA_CHAIN` variable
is not set.

For convenience, the project creation tool registers aliases
in the `scripts` field of the project's `package.json` with
corresponding values of `FADROMA_CHAIN`, so that you can deploy with:

```sh
$ npm run mainnet deploy
$ npm run testnet deploy
$ npm run devnet deploy
$ npm run mocknet deploy
```

### Running scripts

[The **`@hackbg/ganesha`** package](https://github.com/hackbg/ganesha)
enables Fadroma CLI to compile TypeScript on demand. You can use TypeScript
seamlessly in your deploy procedures:

```sh
$ fadroma run script.js
$ fadroma run script.ts
```

### Adding commands

[The **`@hackbg/cmds`** package](https://github.com/hackbg/toolbox/blob/main/cmds/cmds.ts)
allows Fadroma CLI to parse commands. This is a simple and loose command parser which
descends a tree of command definitions, and maps to a regular JS function call.

The default project contains examples for extending project commands (such as `deploy`),
as well as defining new ones.

### Agent API

[The **`@fadroma/agent`** package](/ts/modules/_fadroma_agent.html) is our core library
for interfacing with blockchains and smart contracts from JavaScript or TypeScript.

[The **Fadroma Agent Guide**](agent.html) describes it in more detail.

### Deploy API

The `Deployment` class, as extended in the default project's `api.ts`,
is the backbone of the Fadroma Deploy API.

[The **Fadroma Deploy Guide**](deploy.html) describes that part of the functionality.

### Testing with Devnet

By default, Fadroma deploys to a **devnet**: a local instance of
a blockchain, running in a Docker or Podman container.

[The **Fadroma Devnet Guide**](devnet.html) has more info
on the subject of devnets.

### Testing with Mocknet

[The **Fadroma Mocknet** guide](mocknet.html) describes
our simulated environment for fast full-stack testing of production WASM builds.
Mocknet is built into `@fadroma/agent`.

## More resources

* [HackSecret Fadroma Workshop Repo](https://github.com/hackbg/fadroma-workshop)
* [Fadroma Factory Pattern Example](factory.html)

# Scripting Fadroma deployments

The commands described in the [getting started guide](../README.md) can also be called from
scripts. This is useful if you're trying to combine them in a novel way. This document describes
the internal Fadroma Ops API which powers those commands; it's assumed that you're already familiar
with the [Fadroma Agent API](../agent/README.md), so if you're not, read that first, then come back.

## Build API

* **BuildRaw**: runs the build in the current environment
* **BuildContainer**: runs the build in a container for enhanced reproducibility

### Getting a builder

#### BuildContainer

By default, you get a `BuildContainer`,
which runs the build procedure in a container
provided by either Docker or Podman (as selected
by the `FADROMA_BUILD_PODMAN` environment variable).

`BuildContainer` uses [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock) to
operate the container engine.

Use `FADROMA_DOCKER` or the `dockerSocket` option to specify a non-default Docker socket path.

The `BuildContainer` runs the build procedure defined by the `FADROMA_BUILD_SCRIPT`
in a container based on the `FADROMA_BUILD_IMAGE`, resulting in optimized WASM build artifacts
being output to the `FADROMA_ARTIFACTS` directory.

#### BuildRaw

If you want to execute the build procedure in your
current environment, you can switch to `BuildRaw`
by passing `raw: true` or setting `FADROMA_BUILD_RAW`.

### Building a contract

Now that we've obtained a `Builder`, let's compile a contract from source into a WASM binary.

#### Building a named contract from the project

Building asynchronously returns `Template` instances.
A `Template` is an undeployed contract. You can upload
it once, and instantiate any number of `Contract`s from it.

To build a single crate with the builder:

To build multiple crates in parallel:

For built contracts, the following holds true:

* Build result will contain code hash and path to binary:

* Build result will contain info about build inputs:

The above holds true equally for contracts produced
by `BuildContainer` and `BuildRaw`.

#### Specifying a contract to build

The `Template` and `Contract` classes have the following properties for specifying the source:

|field|type|description|
|-|-|-|
|**`repository`**|Path or URL|Points to the Git repository containing the contract sources. This is all you need if your smart contract is a single crate.|
|**`workspace`**|Path or URL|Cargo workspace containing the contract sources. May or may not be equal to `contract.repo`. May be empty if the contract is a single crate.|
|**`crate`**|string|Name of the Cargo crate containing the individual contract source. Required if `contract.workspace` is set.|
|**`revision`**|string|Git reference (branch or tag). Defaults to `HEAD`, otherwise builds a commit from history.|

The outputs of builds are called **artifact**s, and are represented by two properties:

|field|type|description|
|-|-|-|
|**`artifact`**|URL|Canonical location of the compiled binary.|
|**`codeHash`**|string|SHA256 checksum of artifact. should correspond to **template.codeHash** and **instance.codeHash** properties of uploaded and instantiated contracts|

### Building past commits of contracts

* `DotGit`, a helper for finding the contents of Git history
  where Git submodules are involved. This works in tandem with
  `build.impl.mjs` to enable:
  * **building any commit** from a project's history, and therefore
  * **pinning versions** for predictability during automated one-step deployments.

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

### The build procedure

The ultimate build procedure, i.e. actual calls to `cargo` and such,
is implemented in the standalone script `FADROMA_BUILD_SCRIPT` (default: `build.impl.mjs`),
which is launched by the builders.

### Builders

The subclasses of the abstract base class `Builder` in Fadroma Core
implement the compilation procedure for contracts.

Checksums of compiled contracts by version are stored in the build state
directory, `wasm/`.

### Upload API

The client package, `@fadroma/agent`, exposes a base `Uploader` class,
which the global `fetch` method to obtain code from any supported URL
(`file:///` or otherwise).

This `fetch`-based implementation only supports temporary, in-memory
upload caching: if you ask it to upload the same contract many times,
it will upload it only once - but it will forget all about that
as soon as you refresh the page.

The backend package, `@hackbg/fadroma`, provides `FSUploader`.
This extension of `Uploader` uses Node's `fs` API instead, and
writes upload receipts into the upload state directory for the
given chain (e.g. `state/$CHAIN/uploads/`).

Let's try uploading an example WASM binary:

* Uploading with default configuration (from environment variables):

* Passing custom options to the uploader:

## Devnet API

### Creating the devnet

When scripting with the Fadroma API outside of the standard CLI/deployment
context, you can use the `getDevnet` method to configure and obtain a `Devnet`
instance.

`getDevnet` supports the following options; their default values can be
set through environment variables.

At this point you have prepared a *description* of a devnet.
To actually launch it, use the `create` then the `start` method:

At this point, you should have a devnet container running,
its state represented by files in your project's `state/` directory.

To operate on the devnet thus created, you will need to wrap it
in a **Chain** object and obtain the usual **Agent** instance.

For this, the **Devnet** class has the **getChain** method.

A `Chain` object which represents a devnet has the following additional API:

|name|description|
|-|-|
|**chain.mode**|**ChainMode**: `"Devnet"` when the chain in question is a devnet|
|**chain.isDevnet**|**boolean:** `true` when the chain in question is a devnet|
|**chain.devnet**|**DevnetHandle**: allows devnet internals to be controlled from your script|
|**chain.devnet.running**|**boolean**: `true` if the devnet container is running|
|**chain.devnet.start()**|**()⇒Promise\<this\>**: starts the devnet container|
|**chain.devnet.getAccount(name)**|**(string)⇒Promise\<Partial\<Agent\>\>**: returns info about a genesis account|
|**chain.devnet.assertPresence()**|**()⇒Promise\<void\>**: throws if the devnet container ID is known, but the container itself is not found|

### Devnet accounts

Devnet state is independent from the state of mainnet or testnet.
That means existing wallets and faucets don't exist. Instead, you
have access to multiple **genesis accounts**, which are provided
with initial balance to cover gas costs for your contracts.

When getting an **Agent** on the devnet, use the `name` property
to specify which genesis account to use. Default genesis account
names are `Admin`, `Alice`, `Bob`, `Charlie`, and `Mallory`.

This will populate the created Agent with the mnemonic for that
genesis account.

That's it! You are now set to use the standard Fadroma Agent API
to operate on the local devnet as the specified identity.

#### Custom devnet accounts

You can also specify custom genesis accounts by passing an array
of account names to the `accounts` parameter of the **getDevnet**
function.

### Cleaning up

Devnets are local-only and thus temporary.

To delete an individual devnet, the **Devnet** class
provides the **delete** method. This will stop and remove
the devnet container, then delete all devnet state in your
project's state directory.

To delete all devnets in a project, the **Project** class
provides the **resetDevnets** method:

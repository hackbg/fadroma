# Elements of Fadroma smart contracts

CosmWasm contracts are simply WASM programs that run in a specific environment
defined by the Cosmos runtime. This environment has the well-known blockchain
features of being:

* **Append-only:** every mutation is permanent.
* **Distributed:** it doesn't matter on whose server the program runs.
* **Metered:** mutations cost gas, paid in the chain's native token.

Coming from an OOP background, it might be helpful to view smart contract programs
as something like classes, and smart contract instances as globally persistent instances
of those classes.

## Examples

Some simple single-file contracts can be seen at:

* https://github.com/hackbg/fadroma/tree/v100/examples/echo
* https://github.com/hackbg/fadroma/tree/v100/examples/kv

What follows is a step-by-step guide for adding a contract to your project,
with explanations of what role each step fulfills.

## Create a subdirectory

Each Fadroma contract is a Rust crate, and exists in a separate subdirectory of your project.

```shell
# in "my-project" directory:
mkdir -p contracts/my-contract
```

Add it to your project's global `Cargo.toml`:

```toml
# my-project/Cargo.toml
[workspace]
members = [
  "contracts/my-contract"
]
```

## Write the crate manifest

The first thing a Rust crate needs is a `Cargo.toml`.

```toml
# my-project/contracts/my-contract/Cargo.toml

[package]
name    = "my-contract"
version = "0.1.0"
edition = "2018"

[lib]
crate-type = ["cdylib", "rlib"]
path       = "my_contract.rs"

[dependencies]
fadroma = { version = "100.0.0" }
serde   = { version = "1.0.103", default-features = false, features = ["derive"] }
```

> We deviate from Rust's recommendation of having a `src/` subdirectory,
> so as not to overcomplicate the directory structure of projects.

## Import the prelude

Now, let's write some Rust!

Each Fadroma contract consists of one or more **Rust source files**
that define the interface and implementation.

The `fadroma::prelude` module exposes the underlying platform's native libraries,
as well as useful Fadroma primitives.

```rust
/* my-project/contracts/my-contract/my_contract.rs */

use fadroma::prelude::*;
```

## Define the API

The API of a smart contract consists of 3 types of messages:

* **The init message** corresponds to the "constructor" of the "class". It is called once,
  when instantiating the contract, and is represented by a `struct`, not an `enum`, because
  it has no variants.
* **The handle messages** are represented by an `enum` corresponding to the "methods" of the "class".
  These methods are called from transactions, and they are always written to the blockchain.
  Therefore, they cost gas, and can mutate the contract state.
* **The query messages** are represented by an `enum` corresponding to "getters".
  You can pass parameters to them, and they can read from the contract state, but they
  can't perform mutations, and, unlike init and handle, don't have access to the `env` struct
  which contains info such as the sender address and the current time.

```rust
/* my-project/contracts/my-contract/my_contract.rs (continued) */

#[message] pub struct InitMsg {
    /* init fields - your "constructor arguments" */
}

#[message] pub enum HandleMsg {
    Tx1,                      // "tx1"
    Tx2(Uint128),             // {"tx2":"12345"}
    Tx3 {},                   // {"tx3:{}},
    Tx4 { my_value: Uint128 } // {"tx4":{"my_value":"12345"}}
}

#[message] pub enum QueryMsg  {
    Q1,                      // "q1"
    Q2(Uint128),             // {"q2":"12345"}
    Q3 {},                   // {"q3:{}},
    Q4 { my_value: Uint128 } // {"q4":{"my_value":"12345"}}
}
```

## Implement the handlers

```rust
/* my-project/contracts/my-contract/my_contract.rs (continued) */

pub fn init<S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>, env: Env, msg: InitMsg,
) -> StdResult<InitResponse> {
    /* implementation of your init procedure */
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: HandleMsg,
) -> StdResult<HandleResponse> {
    /* dispatch and implement transactions */
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    _deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    /* dispatch and implement queries */
}
```

## Add the entry point

The `fadroma::entrypoint!` macro binds the `init`, `handle`, and `query`
to the CosmWasm environment. When building for production, it defines a
hidden `mod wasm` module that calls the functions with the transaction data
passed by the user.

```rust
/* my-project/contracts/my-contract/my_contract.rs (continued) */

fadroma::entrypoint!(fadroma, init, handle, query);
```

---

## Cargo workspace setup

* Fadroma contains several Rust crates, and therefore projects that embed it as a Git submodule
  need to use Cargo workspaces.

* For a project containing two contracts, `Allocator` and `Generator`, and two non-contract
  crates, `api` and `shared`, the root `Cargo.toml` could look like this:

* Add `~/project/Cargo.toml`:

```toml
# Crates in workspace
[workspace]
members = [
  # Crates from Fadroma
  "fadroma/crates/*",
  # Your crates
  "contracts/allocator",
  "contracts/generator",
  # Non-contract crates still work:
  "libraries/api",
  "libraries/shared", # etc...
]

# Release profile
[profile.release]
codegen-units    = 1
debug            = false
debug-assertions = false
incremental      = false
lto              = true
opt-level        = 3
overflow-checks  = true
panic            = 'abort'
rpath            = false
```

## PNPM workspace setup

* To install [PNPM](https://pnpm.io):

```sh
npm i -g pnpm
```

* Add `~/project/.npmrc`:

```toml
prefer-workspace-packages=true
ignore-workspace-root-check=true
strict-peer-dependencies=false
```

* Add `~/project/pnpm-workspace.yaml`:

```yaml
# this file intentionally left blank
```

* Add `~/project/package.json`:

```json
{
  "name":      "@your/project",
  "version":   "0.0.0",
  "type":      "module",
  "main":      "index.ts",
  "workspace": true,
  "devDependencies": {
    "typescript":      "^5",
    "@hackbg/fadroma": "workspace:*",
    "@your/api":       "workspace:*"
  },
  "scripts": {
    "fadroma": "fadroma index.ts"
  }
}
```

* Make sure submodule is present:

```shell
git submodule update --init --recursive
```

* Install dependencies:

```shell
pnpm i
```

* To run your `index.ts` with Fadroma:

```shell
pnpm exec fadroma index.ts command arg1 arg2
# with package.json script, becomes:
pnpm fadroma command arg1 arg2
```

## Contract setup

* Add `~/project/contracts/allocator/Cargo.toml`:

```toml
[package]
name    = "your-allocator"
version = "0.1.0"
[lib]
crate-type = ["cdylib", "rlib"]
path       = "allocator.rs"
[dependencies]
fadroma = { path = "../../fadroma/crates/fadroma", features = [
  # add fadroma features flags here
] }
```

* Add `~/project/contracts/allocator/allocator.rs`:

```rust
use fadroma::prelude::*;
#[message] pub struct InitMsg { /**/ }
#[message] pub enum HandleMsg { /**/ }
#[message] pub enum QueryMsg  { /**/ }
pub fn init   /*...*/
pub fn handle /*...*/
pub fn query  /*...*/
fadroma::entrypoint!(fadroma, init, handle, query);
```

## API client setup

* Add `~/project/api/package.json`:

```json
{
  "name":    "@your/api",
  "version": "0.1.0",
  "type":    "module",
  "main":    "api.ts",
  "dependencies": {
    "@fadroma/core":   "1",
    "@fadroma/tokens": "1"
  }
}
```

* Add `api/api.ts`:

```typescript
import * as Fadroma from '@hackbg/fadroma'
import { Snip20 } from '@fadroma/tokens'

/** API client for "contracts/allocator" */
export class Allocator extends Fadroma.Client {
  // Generate init message for deployment
  static init (min: number, max: number) {
    if (max >= min) throw new Error('invalid range')
    return { allocation_range: [ min, max ] }
  })
  // Call query method of deployed contract
  getAllocation (): number {
    return this.query({get:{}})
  }
  // Call transaction method of deployed contract
  setAllocation (allocation: number) {
    return this.execute({set: number})
  }
}

/** API client for "contracts/generator" */
export class Generator extends Snip20 {
  // extend the Snip20 client if your contract
  // is a customized SNIP-20 token
}
```

## Deploy procedure

* Add `~/project/index.ts`:

```typescript
import * as Fadroma from '@hackbg/fadroma'
import * as API     from '@your/api'

const contracts = [
  'allocator',
  'generator'
]

const plugins = [
  Fadroma.enableScrtBuilder,
  Fadroma.getChain,
  Fadroma.getAgent,
  Fadroma.getFileUploader,
]

export default new Fadroma.Ops('name', plugins)

  .command('build',  'compile contracts',
    function build ({ buildMany }) {
      return {
        artifacts: buildMany(contracts)
      }
    })

  .command('deploy', 'build and deploy contracts',
    function deploy ({ buildAndUploadMany, deploy, getClient }) {
      const [template1, template2] = await buildAndUploadMany(contracts)
      await deploy('Allocator', template1, { init: 'message' })
      await deploy('Generator', template2, { init: 'message' })
      return {
        allocator: getClient('Allocator', API.Allocator),
        generator: getClient('Generator', API.Generator)
      }
    })

  .command('status', 'query status of contracts',
    async function printStatus ({
      getClient,
      allocator = getClient('Allocator', API.Allocator)
    }) {
      console.log(await allocator.getAllocation())
    })

  .command('configure', 'configure contracts',
    async function configure ({ getClient }) {
      // ..
    })

  // More commands

  // Keep this at the end
  .entrypoint(import.meta.url)

```

* To run commands defined in `index.ts`:

```sh
pnpm run your build
```


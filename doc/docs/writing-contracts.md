# Writing a smart contract with Fadroma

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

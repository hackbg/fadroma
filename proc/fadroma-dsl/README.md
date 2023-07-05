# Writing smart contracts with Fadroma DSL

The `fadroma-dsl` crate defines a simple **procedural macro-based DSL** that
helps you write **composable, boilerplate-free CosmWasm smart contracts**.

**Fadroma DSL** sets out to achieve two main goals:

* **Brevity.** Repetitive code that you'd otherwise write manually is generated automatically
  in a structured way.

* **Composability.** The procedural macro provides a reliable and flexible system for composing
  common smart contract functionality and extending contracts. Individual high-level features,
  such as admin functionality, can easily be added to a smart contract, reused and extended as
  needed. The granularity of this extends to the individual functions. Furthermore, dependencies
  between Fadroma DSL-based features can be defined and enforced.

Any misuse of the macro will result in simple **compile errors** -- not some hidden or unexpected
runtime behavior. Additionally, the macro error messages should tell you exactly what you need to
add or change in order for the code to compile.

### Prerequisites

Using Fadroma DSL assumes you're familiar with the general architecture and operational model
of CosmWasm smart contracts.

### Examples

For a quick comparison of DSL-based code vs. "raw" CosmWasm, see [Comparison](#comparison).

See also: the [`examples`](https://github.com/hackbg/fadroma/tree/master/examples)
directory in the Fadroma repo. These examples showcase how to use the DSL and the pre-defined
DSL-based features in Fadroma. Furthermode, the DSL-based features can be used in non-DSL contracts.

## Usage

### Attribute macros

The DSL has the following attributes defined:

**Note that you don't you don't have to remember all the attributes and
rules around them because the compiler will guide you.**

#### **`#[contract] mod`**

* Only valid for `mod` items. The `mod` will contain the entire implementation of your contract.

```rust
#[contract]
pub mod contract {
  /* ... */
}
```

* It generates a zero-sized `Contract` struct, on which you must implement
  the contract API methods, as well as any interfaces that you wish to support.

* All methods marked with any of the `#[init]`, `#[execute]` or `#[query]` attributes
  will be included as part of the available functionality that the contract exposes.

* You are free to write any other `Contract` methods or functions inside the module as well.

* Interfaces are implemented for the contract using the standard Rust syntax i.e
  `impl MyTrait for Contract { ... }`, where `MyTrait` is a trait declared with the
  `#[interface]` attribute.

* Technically you can use any trait that satisfies the types that `#[interface]` requires,
  and it won't break anything since the macro enforces that.

* The macro also generates an `Error` enum that represents all possible errors that you use
  across your contract and the interfaces that it implements. This is used in the generated
  `execute` and `query` functions but rather an implementation detail that ties everything together.
  On the other hand, it's there if you want to use it for anything.

#### **`#[interface] mod`**

* Used when you have multiple contracts that talk to each other. (Otherwise you don't need this
  attribute and can just use `#[contract]`.)

* This attribute allows to define the interface of your contract separately,
  automatically generating the `InstantiateMsg` (if present), `ExecuteMsg` and `QueryMsg` structs
  that represent the contract API, but not the corresponding functions that implement it.

* This means that the interface can be defined in a separate crate and can be consumed by multiple
  other crates that implement a contract.

* This approach plays well with the common pattern of defining all contract messages in a single
  crate, and having the contract crates use that to implement and call each other.

* In addition, having to implement the interface trait in your contract means that Rust will
  never let the interface and implementation go out of sync.

* The interface requires you to declare the associated type `type Error: std::fmt::Display;` and
  all methods must return that as an error type. This allows to have a custom error type.
  Otherwise, just use `cosmwasm_std::StdError`.

#### **`#[init] fn`**

* The instantiate method for the contract.

* There can be only one per contract but each interface that your contract implements must have it
  as well if it has it defined.

* Can be omitted altogether both in `#[contract]` and `#[interface]` contexts.
  When used in the latter, it will simply generate an `InstantiateMsg` struct.
  In the former it only serves as a marker inside any implemented interfaces,
  unless the `entry` meta argument is used.

##### Meta arguments

* `entry`

  * Used as `#[init(entry)]` and creates the `InstantiateMsg`, `ExecuteMsg` and `QueryMsg` structs,
    the `instantiate`, `execute` and `query` entry point functions.

  * Is optional.

  * Can only be used in `#[contract]`.

  * Only a single `#[init]` can be marked with it and this includes any interfaces that
    the contract implements.

  * If you have an `#[init]` attribute in one of your contract methods (inside the
    `impl Contract` block) you must add this attribute. The reasoning for this being that since
    this is what generates the message enums and entry functions, having an `#[init]` attribute in
    a contract method (but not in interface methods) without it would basically do nothing.

* `entry_wasm`

  * Generates the same boilerplate and has the same rules as the `entry` meta
    but will also generate the WASM boilerplate FFI module.

#### **`#[execute] fn`**

* A method that is part of the executable set of methods of the contract.

* Each method that is to be part of that set must be annotated with that.

* The generated `ExecuteMsg` enum is comprised of the names of all those methods.

* Dispatch also happens automatically through the generated `execute` functions.
  This is all code that you'd write yourself.

#### **`#[query] fn`**

* Identical to how the `#[execute]` attribute works

* Generates the `QueryMsg` enum and the `query` function.

#### **`#[reply] fn`**

* Marks the method as a CosmWasm reply handler.

* Only **one** such function can exist per contract
  and it must have a single parameter with the `cosmwasm_std::Reply` type.

#### **`#[execute_guard] fn`**

* An execute guard function is a special function that is called before matching the `ExecuteMsg`
  enum inside the `execute` function both of which are generated by the macro.

* Only **one** such function can exist per contract and it must have a single parameter
  with the `&ExecuteMsg` type.

* It is useful in cases where we want to assert some state before proceeding with executing
  the incoming message and fail before that if necessary. For [example](https://github.com/hackbg/fadroma/blob/master/examples/derive-contract-components/src/lib.rs#L24-L38),
  it should be used with Fadroma's killswitch component: inside the execute guard, we check whether
  the contract is pausing or migrated and return an `Err(())` if so.

#### **`#[auto_impl] impl`**

* Only valid for trait `impl` blocks.

* It takes a path to a struct which implements the given interface trait being implemented.

* For each method that is part of the trait, it delegates the implementation to the given struct.

* We ensure that the provided struct exactly implements the trait by using Rust's fully qualified
  syntax (`<MyStruct as Trait>::method_name()`).

* It will also fill in the concrete `Error` type that the interface must have.

* You delegate the implementation to the struct by leaving the method body **completely** empty.

* Otherwise, writing a method body will use your code. This allows for great flexibility since you
  can implement an interface by using an  existing implementation while allowing you to directly
  override any methods that you wish. For example:

```rust ignore
#[auto_impl(ImplementingStuct)]
impl MyInterface for Contract {
  // Here we leave the body empty and it will delegate the implementation to ImplementingStuct
  #[execute]
  fn first_method(some_arg: u32) -> Result<Response, Self::Error> {
    // The macro inserts the following code here
    // <ImplementingStuct as MyInterface>::first_method(deps, env, info, some_arg)
  }

  // Here we provide our own implementation so ImplementingStuct is not used at all.
  #[execute]
  fn second_method() -> Result<Response, Self::Error> {
    Ok(Response::default())
  }
}
```

#### Meta arguments

* Path to the struct that implements the trait

* Not optional.

* The ubiquitous `Deps`/`DepsMut`, `Env` and `MessageInfo` types are automatically added
  to generated method signatures, so that they don't need to be specified all the time.

* Parameters that your message declares are appended after those in the method signature.
  The following table describes which attribute includes what parameters:

|Attribute       |Generated signature                                    |
|----------------|-------------------------------------------------------|
|#[init]         |`deps: DepsMut, env: Env, info: MessageInfo, ...msg`   |
|#[execute]      |`deps: DepsMut, env: Env, info: MessageInfo, ...msg`   |
|#[query]        |`deps: Deps, env: Env, ...msg`                         |
|#[reply]        |`deps: DepsMut, env: Env, ...msg`                      |
|#[execute_guard]|`deps: DepsMut, env: &Env, info: &MessageInfo, ...msg` |

## Comparison

To better understand what the macro generates, here's a simple contract:

```rust ignore
#[fadroma::dsl::contract]
pub mod counter_contract {
    use fadroma::{
        dsl::*,
        admin::{self, Admin, Mode},
        schemars,
        cosmwasm_std::{self, Response, Addr, StdError}
    };

    impl Contract {
        #[init(entry_wasm)]
        pub fn new(initial_value: u64) -> Result<Response, StdError> {
            Ok(Response::default())
        }
        #[execute]
        pub fn add(value: u64) -> Result<Response, StdError> {
            Ok(Response::default())
        }
        #[query]
        pub fn value() -> Result<u64, StdError> {
            Ok(0)
        }
    }

    #[auto_impl(admin::DefaultImpl)]
    impl Admin for Contract {
        #[execute]
        fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error> { }
        #[query]
        fn admin() -> Result<Option<Addr>, Self::Error> { }
    }
}
```

And here's what the expanded code ends up looking like:

```rust ignore
pub mod counter_contract {
    use fadroma::{
        dsl::*,
        admin::{self, Admin, Mode},
        schemars,
        cosmwasm_std::{self, Response, Addr, StdError}
    };

    #[derive(Clone, Copy)]
    pub struct Contract;

    impl Contract {
        pub fn new(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            initial_value: u64,
        ) -> Result<Response, StdError> {
            Ok(Response::default())
        }

        pub fn add(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            value: u64,
        ) -> Result<Response, StdError> {
            Ok(Response::default())
        }

        pub fn value(
            deps: cosmwasm_std::Deps,
            env: cosmwasm_std::Env
        ) -> Result<u64, StdError> {
            Ok(0)
        }
    }

    impl Admin for Contract {
        type Error = <admin::DefaultImpl as Admin>::Error;

        fn change_admin(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            mode: Option<Mode>,
        ) -> Result<Response, Self::Error> {
            <admin::DefaultImpl as Admin>::change_admin(deps, env, info, mode)
        }
        fn admin(
            deps: cosmwasm_std::Deps,
            env: cosmwasm_std::Env,
        ) -> Result<Option<Addr>, Self::Error> {
            <admin::DefaultImpl as Admin>::admin(deps, env)
        }
    }

    #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
    pub struct InstantiateMsg {
        pub initial_value: u64,
    }

    #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
    #[serde(rename_all = "snake_case")]
    pub enum ExecuteMsg {
        Add { value: u64 },
        ChangeAdmin { mode: Option<Mode> },
    }

    #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
    #[serde(rename_all = "snake_case")]
    pub enum QueryMsg {
        Value {},
        Admin {},
    }

    #[derive(Debug)]
    pub enum Error {
        // The macro needs this to signal errors when calling cosmwasm_std::to_binary
        // in the query function that it generates when the call fails.
        #[doc(hidden)]
        QueryResponseSerialize(String),
        // We call this for every method inside the impl Contract block.
        Base(StdError),
        // One for each interface implemented.
        Admin(<Contract as Admin>::Error),
    }

    impl std::fmt::Display for Error {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                Self::QueryResponseSerialize(msg) => f.write_fmt(
                    format_args!("Error serializing query response: {}", msg)
                ),
                Self::Base(x) => std::fmt::Display::fmt(x, f),
                Self::Admin(x) => std::fmt::Display::fmt(x, f),
            }
        }
    }

    impl std::error::Error for Error {}

    pub fn instantiate(
        mut deps: cosmwasm_std::DepsMut,
        env: cosmwasm_std::Env,
        info: cosmwasm_std::MessageInfo,
        msg: InstantiateMsg,
    ) -> Result<Response, StdError> {
        Contract::new(deps, env, info, msg.initial_value)
    }

    pub fn execute(
        mut deps: cosmwasm_std::DepsMut,
        env: cosmwasm_std::Env,
        info: cosmwasm_std::MessageInfo,
        msg: ExecuteMsg,
    ) -> std::result::Result<cosmwasm_std::Response, Error> {
        match msg {
            ExecuteMsg::Add { value } => {
                Contract::add(deps, env, info, value).map_err(|x| Error::Base(x))
            }
            ExecuteMsg::ChangeAdmin { mode } => {
                Contract::change_admin(deps, env, info, mode).map_err(|x| Error::Admin(x))
            }
        }
    }

    pub fn query(
        deps: cosmwasm_std::Deps,
        env: cosmwasm_std::Env,
        msg: QueryMsg,
    ) -> std::result::Result<cosmwasm_std::Binary, Error> {
        match msg {
            QueryMsg::Value {} => {
                let result = Contract::value(deps, env).map_err(|x| Error::Base(x))?;
                cosmwasm_std::to_binary(&result)
                    .map_err(|x| Error::QueryResponseSerialize(x.to_string()))
            }
            QueryMsg::Admin {} => {
                let result = Contract::admin(deps, env).map_err(|x| Error::Admin(x))?;
                cosmwasm_std::to_binary(&result)
                    .map_err(|x| Error::QueryResponseSerialize(x.to_string()))
            }
        }
    }

    #[cfg(target_arch = "wasm32")]
    mod wasm_entry {
        use super::cosmwasm_std::{do_instantiate, do_execute, do_query};

        #[no_mangle]
        extern "C" fn instantiate(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
            do_instantiate(&super::instantiate, env_ptr, info_ptr, msg_ptr)
        }

        #[no_mangle]
        extern "C" fn execute(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
            do_execute(&super::execute, env_ptr, info_ptr, msg_ptr)
        }

        #[no_mangle]
        extern "C" fn query(env_ptr: u32, msg_ptr: u32) -> u32 {
            do_query(&super::query, env_ptr, msg_ptr)
        }
    }
}
```

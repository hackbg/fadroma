<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Derive Contract ![](https://img.shields.io/badge/version-0.1.0-blueviolet)

**This document describes how to write boilerplate-free CosmWasm smart contracts using a `derive-contract` procedural macro.**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

</div>

## Introduction
Derive contract macro takes care of all necessary boilerplate in CosmWasm smart contracts and provides a more productive development experience. The goal is to generate the repetitive code that you'd write anyway and nothing more, while providing as much flexibility as possible. Any misuse of the macro will result in **compile errors** and not some hidden or unexpected runtime behavior.

## Getting started
Derive macro can be used for direct contract implementations with `#[contract(entry)]` or for contracts that implement **interfaces** with `#[contract_impl(entry, path="some_interface")]`.
An interface implementation should be used over direct implementations if there's any intercontract communication, this allows to include messages of other contracts without any cyclical dependencies as those messages are exported by the interface and as such can be declared in a shared crate which is then included by individual contract crates. This is an extremely common pattern when writing CosmWasm based contracts.

### **Attributes**
The derive-contract macro supports the following attributes:  
| Attribute         | Description                                                                                                      |
|-------------------|------------------------------------------------------------------------------------------------------------------|
| **init**          | The `init` method of the contract. Only one per contract. Can be omitted if not using `entry` (in components).   |
| **handle**        | The `handle` method of the contract. One per handle method.                                                      |
| **query**         | The `query` method of the contract. One per query method.                                                        |
| **handle_guard**  | A function marked with this will be called before any handle method execution. Only one per contract (optional). |
| **component**     | Used to include a component.                                                                                     |
| **entry**         | Signals that WASM entry points should be generated for the current contract.                                     |
| **path**          | Specifies a path to a type or a namespace.                                                                       |
| **skip**          | Used to not include a handle/query of the component.                                                             |
| **custom_impl**   | Used to provide a custom implementation of a component instead of using the auto generated default trait impl.   |

### **Usage**
Since their usage is always a fact, we decided to implicitly include the `Env` and `Extern` types from `cosmwasm_std` as parameters to the relevant methods so that they don't need to be specified all the time. The following table describes which attribute includes what parameters:

|Attribute    |Parameter name|Parameter type    |
|-------------|--------------|------------------|
|init         |deps          |&mut Extern<S,A,Q>|
|init         |env           |Env               |
|handle       |deps          |&mut Extern<S,A,Q>|
|handle       |env           |Env               |
|query        |deps          |&Extern<S,A,Q>    |
|handle_guard |deps          |&mut Extern<S,A,Q>|
|handle_guard |env           |&Env              |

The names of the methods annotated with `handle` and `query` are used as the enum messsage variants (converted to pascal case) in their respective definitions.

#### **Basic contract**
```rust
// contract.rs
#[contract(entry)]
pub trait Contract {
    #[init]
    fn new(config: Config) -> StdResult<InitResponse> {
        Ok(InitResponse::default())
    }

    #[handle]
    fn set_config(config: Config) -> StdResult<HandleResponse> {
        Ok(HandleResponse::default())
    }

    #[query]
    fn get_config() -> StdResult<Config> {
        Ok(Config)
    }
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Config;
```
To get a better idea of what the macro actually does, the above code is equivalent to the following (without including WASM boilerplate):
```rust
pub trait Contract {
    fn new<S: Storage, A: Api, Q: Querier>(
        &self,
        config: Config,
        deps: &mut Extern<S, A, Q>,
        env: Env,
    ) -> StdResult<InitResponse> {
        Ok(InitResponse::default())
    }
    fn set_config<S: Storage, A: Api, Q: Querier>(
        &self,
        config: Config,
        deps: &mut Extern<S, A, Q>,
        env: Env,
    ) -> StdResult<HandleResponse> {
        Ok(HandleResponse::default())
    }
    fn get_config<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
    ) -> StdResult<Config> {
        Ok(Config)
    }
}

pub struct DefaultImpl;

impl Contract for DefaultImpl {}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct InitMsg {
    pub config: Config,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum HandleMsg {
    SetConfig { config: Config },
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum QueryMsg {
    GetConfig {},
}

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
    contract: impl Contract,
) -> StdResult<InitResponse> {
    contract.new(msg.config, deps, env)
}
pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
    contract: impl Contract,
) -> StdResult<HandleResponse> {
    match msg {
        HandleMsg::SetConfig { config } => contract.set_config(config, deps, env),
    }
}
pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
    contract: impl Contract,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetConfig {} => {
            let result = contract.get_config(deps)?;
            to_binary(&result)
        }
    }
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Config;

-- WASM boilerplate omitted --
```

#### **With an interface**
```rust
// shared/interfaces/contract.rs
#[interface]
pub trait Contract {
    #[init]
    pub fn new(config: Config) -> StdResult<InitResponse>;

    #[handle]
    pub fn set_config(config: Config) -> StdResult<HandleResponse>;

    #[query]
    pub fn get_config() -> StdResult<Config>;
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Config;

// contracts/contract.rs
#[contract_impl(entry, path="shared::interfaces::contract")]
pub trait Contract {
    #[init]
    fn new(config: Config) -> StdResult<InitResponse> {
        Ok(InitResponse::default())
    }

    #[handle]
    fn set_config(config: Config) -> StdResult<HandleResponse> {
        Ok(HandleResponse::default())
    }

    #[query]
    fn get_config() -> StdResult<Config> {
        Ok(Config)
    }
}

// some other contract
// contracts/other_contract.rs
use shared::interfaces::contract::{HandleMsg, QueryMsg};
-- snip --
```
This code will generate the necessary entry points and dispatch functions using the messages exported by the interface module. The interface definition only generates the `InitMsg`, `HandleMsg` and `QueryMsg` types. In addition, its methods cannot have a default implementation. Note that the interface definition and the implementing contract cannot go out of sync since any deviation between the two will result in compile errors.

#### **Handle guard**

A handle guard function is a special function that is called before matching the `HandleMsg` enum inside the `handle` function both of which are generated by the macro. It **must** take no arguments, return `StdResult<()>` and is annotated with the `handle_guard` attribute. Only **one** such function can exist per contract definition. It is useful in cases where we want to assert some state before proceeding with executing the incoming message and fail before that if necessary. For example, it should be used with the Fadroma killswitch component. Inside the handle guard we check whether the contract is pausing or migrated and return an `Err(())` if so.

### **Components**

A component is simply a contract declared somewhere else using the `contract` macro. We can reuse its functionality by including it via the `component` attribute in our current contract.

One or many components can be used in a single contract like so:

```rust
#[contract(
    component(path = "fadroma::admin"),
    component(path = "fadroma::killswitch")
)]
```
or when implementing an interface:
```rust
#[contract_impl(
    path = "shared::interfaces::contract",
    component(path = "fadroma::admin"),
    component(path = "fadroma::killswitch")
)]
```
The macro will include their handle and query message enums in the current message enums as tuple variants. The name of the variant is derived from the last segment in the `path` argument of the component. For example, the above code will generate the following handle message:

```rust
pub enum HandleMsg {
    Admin(fadroma::admin::HandleMsg),
    Killswitch(fadroma::killswitch::HandleMsg)
    // .. other variants
}
```

### **skip**
A component may not implement any query or handle methods (like the Fadroma auth component). In that case those should be skipped in the importing contract messages by specifying the `skip` attribute like so:
```rust
#[contract(
    component(path = "fadroma::auth", skip(query)),
)]
```
Valid tokens are `query` and `handle`. Both can be used at the same time as well.

### **custom_impl**
Sometimes we may want to use a component but change the implementation of one (or many) of its methods. In that case all we need to do is implement the component trait on a new empty struct (like we'd normally do in Rust) and specify its name in the component definition using the `custom_impl` attribute. By default the macro will use the `DefaultImpl` struct which it generates for every `contract` and `contract_impl`. If we wanted to use our custom implementation it would look like this:

```rust
#[contract(
    component(path = "fadroma::admin", custom_impl = "MyCustomAdminImplStruct"),
)]
```
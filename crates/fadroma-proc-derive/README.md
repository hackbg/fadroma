# Fadroma Derive Contract

![](https://img.shields.io/badge/version-0.1.0-blueviolet)

**Procedural macros for composable boilerplate-free CosmWasm smart contracts.**

## Introduction
Derive contract macro takes care of all necessary boilerplate in CosmWasm smart contracts and provides a more productive development experience. The goal is to generate the repetitive code that you'd write anyway and nothing more, while providing as much flexibility as possible. Any misuse of the macro will result in **compile errors** and not some hidden or unexpected runtime behavior.

## Getting started
Derive macro can be used for direct contract implementations with `#[contract(entry)]` or for contracts that implement **interfaces** with `#[contract_impl(entry, path="some_interface")]`.
An interface implementation should be used over direct implementations if there's any intercontract communication, this allows to include messages of other contracts without any cyclical dependencies as those messages are exported by the interface and as such can be declared in a shared crate which is then included by individual contract crates. This is an extremely common pattern when writing CosmWasm based contracts.

## **Attributes**
The derive-contract macro supports the following attributes:  
| Attribute         | Description                                                                                                      |
|-------------------|------------------------------------------------------------------------------------------------------------------|
| **init**          | The `init` method of the contract. Only one per contract. Can be omitted if not using `entry` (in components).   |
| **execute**        | The `execute` method of the contract. One per execute method.                                                      |
| **query**         | The `query` method of the contract. One per query method.                                                        |
| **execute_guard**  | A function marked with this will be called before any execute method execution. Only one per contract (optional). |
| **component**     | Used to include a component.                                                                                     |
| **entry**         | Signals that WASM entry points should be generated for the current contract.                                     |
| **path**          | Specifies a path to a type or a namespace.                                                                       |
| **skip**          | Used to not include a execute/query of the component.                                                             |
| **custom_impl**   | Used to provide a custom implementation of a component instead of using the auto generated default trait impl.   |

## **Usage**
Since their usage is always a fact, we decided to implicitly include the `Env` and `Extern` types from `cosmwasm_std` as parameters to the relevant methods so that they don't need to be specified all the time. The following table describes which attribute includes what parameters:

|Attribute    |Parameter name|Parameter type    |
|-------------|--------------|------------------|
|init         |deps          |DepsMut           |
|init         |env           |Env               |
|init         |info          |MessageInfo       |
|execute       |deps          |DepsMut           |
|execute       |env           |Env               |
|execute       |info          |MessageInfo       |
|query        |deps          |Deps              |
|query        |env           |Env               |
|execute_guard |deps          |DepsMut           |
|execute_guard |env           |&Env              |
|execute_guard |info          |&MessageInfo      |

The names of the methods annotated with `execute` and `query` are used as the enum messsage variants (converted to pascal case) in their respective definitions.

## **Basic contract**
```rust
// contract.rs
#[contract(entry)]
pub trait Contract {
    #[init]
    fn new(config: Config) -> StdResult<Response> {
        Ok(Response::default())
    }

    #[execute]
    fn set_config(config: Config) -> StdResult<Response> {
        Ok(Response::default())
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
    fn new(
        &self,
        config: Config,
        mut deps: cosmwasm_std::DepsMut,
        env: cosmwasm_std::Env,
        info: cosmwasm_std::MessageInfo,
    ) -> StdResult<Response> {
        Ok(Response::default())
    }

    fn set_config(
        &self,
        config: Config,
        mut deps: cosmwasm_std::DepsMut,
        env: cosmwasm_std::Env,
        info: cosmwasm_std::MessageInfo,
    ) -> StdResult<Response> {
        Ok(Response::default())
    }

    fn get_config(&self, deps: cosmwasm_std::Deps, env: cosmwasm_std::Env) -> StdResult<Config> {
        Ok(Config)
    }
}

#[derive(Clone, Copy)]
pub struct DefaultImpl;

impl Contract for DefaultImpl {}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
pub struct InstantiateMsg {
    pub config: Config,
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    SetConfig { config: Config },
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetConfig {},
}

pub fn instantiate(
    deps: cosmwasm_std::DepsMut,
    env: cosmwasm_std::Env,
    info: cosmwasm_std::MessageInfo,
    msg: InstantiateMsg,
    contract: impl Contract,
) -> cosmwasm_std::StdResult<cosmwasm_std::Response> {
    contract.new(msg.config, deps, env, info)
}

pub fn execute(
    mut deps: cosmwasm_std::DepsMut,
    env: cosmwasm_std::Env,
    info: cosmwasm_std::MessageInfo,
    msg: ExecuteMsg,
    contract: impl Contract,
) -> cosmwasm_std::StdResult<cosmwasm_std::Response> {
    match msg {
        ExecuteMsg::SetConfig { config } => contract.set_config(config, deps, env, info),
    }
}

pub fn query(
    deps: cosmwasm_std::Deps,
    env: cosmwasm_std::Env,
    msg: QueryMsg,
    contract: impl Contract,
) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> {
    match msg {
        QueryMsg::GetConfig {} => {
            let result = contract.get_config(deps, env)?;
            cosmwasm_std::to_binary(&result)
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::cosmwasm_std::{
        do_execute, do_instantiate, do_query, to_binary, Deps, DepsMut, Env, MessageInfo,
        QueryResponse, Response, StdResult,
    };

    fn entry_init(
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        msg: super::InstantiateMsg,
    ) -> StdResult<Response> {
        super::instantiate(deps, env, info, msg, super::DefaultImpl)
    }

    pub fn entry_execute(
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        msg: super::ExecuteMsg,
    ) -> StdResult<Response> {
        super::execute(deps, env, info, msg, super::DefaultImpl)
    }

    fn entry_query(deps: Deps, env: Env, msg: super::QueryMsg) -> StdResult<QueryResponse> {
        let result = super::query(deps, env, msg, super::DefaultImpl)?;
        to_binary(&result)
    }

    #[no_mangle]
    extern "C" fn instantiate(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
        do_instantiate(&entry_init, env_ptr, info_ptr, msg_ptr)
    }

    #[no_mangle]
    extern "C" fn execute(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
        do_execute(&entry_execute, env_ptr, info_ptr, msg_ptr)
    }
    
    #[no_mangle]
    extern "C" fn query(env_ptr: u32, msg_ptr: u32) -> u32 {
        do_query(&entry_query, env_ptr, msg_ptr)
    }
}
```

## **With an interface**
```rust
// shared/interfaces/contract.rs
#[interface]
pub trait Contract {
    #[init]
    pub fn new(config: Config) -> StdResult<Response>;

    #[execute]
    pub fn set_config(config: Config) -> StdResult<Response>;

    #[query]
    pub fn get_config() -> StdResult<Config>;
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Config;

// contracts/contract.rs
#[contract_impl(entry, path="shared::interfaces::contract")]
pub trait Contract {
    #[init]
    fn new(config: Config) -> StdResult<Response> {
        Ok(Response::default())
    }

    #[execute]
    fn set_config(config: Config) -> StdResult<Response> {
        Ok(Response::default())
    }

    #[query]
    fn get_config() -> StdResult<Config> {
        Ok(Config)
    }
}

// some other contract
// contracts/other_contract.rs
use shared::interfaces::contract::{ExecuteMsg, QueryMsg};
-- snip --
```
This code will generate the necessary entry points and dispatch functions using the messages exported by the interface module. The interface definition only generates the `InstantiateMsg`, `ExecuteMsg` and `QueryMsg` types. In addition, its methods cannot have a default implementation. Note that the interface definition and the implementing contract cannot go out of sync since any deviation between the two will result in compile errors.

## **Execute guard**

A execute guard function is a special function that is called before matching the `ExecuteMsg` enum inside the `execute` function both of which are generated by the macro. It **must** take no arguments and be annotated with the `execute_guard` attribute. Only **one** such function can exist per contract definition. It is useful in cases where we want to assert some state before proceeding with executing the incoming message and fail before that if necessary. For example, it should be used with the Fadroma killswitch component. Inside the execute guard we check whether the contract is pausing or migrated and return an `Err(())` if so.

## **Components**

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
The macro will include their execute and query message enums in the current message enums as tuple variants. The name of the variant is derived from the last segment in the `path` argument of the component. For example, the above code will generate the following execute message:

```rust
pub enum ExecuteMsg {
    Admin(fadroma::admin::ExecuteMsg),
    Killswitch(fadroma::killswitch::ExecuteMsg)
    // .. other variants
}
```

### **skip**
A component may not implement any query or execute methods (like the Fadroma auth component). In that case those should be skipped in the importing contract messages by specifying the `skip` attribute like so:
```rust
#[contract(
    component(path = "fadroma::auth", skip(query)),
)]
```
Valid tokens are `query` and `execute`. Both can be used at the same time as well.

## **custom_impl**
Sometimes we may want to use a component but change the implementation of one (or many) of its methods. In that case all we need to do is implement the component trait on a new empty struct (like we'd normally do in Rust) and specify its name in the component definition using the `custom_impl` attribute. By default the macro will use the `DefaultImpl` struct which it generates for every `contract` and `contract_impl`. If we wanted to use our custom implementation it would look like this:

```rust
#[contract(
    component(path = "fadroma::admin", custom_impl = "MyCustomAdminImplStruct"),
)]
```

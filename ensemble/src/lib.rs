//! Test multiple contract interactions using unit tests.
//! *Feature flag: `ensemble`*

mod bank;
mod ensemble;
mod env;
mod querier;
mod storage;
mod block;
mod response;
#[cfg(feature = "ensemble-staking")]
mod staking;
mod state;
mod execution_state;
mod error;
mod event;

#[cfg(test)]
mod tests;

pub use ensemble::*;
pub use env::*;
pub use querier::*;
pub use block::Block;
pub use response::*;
pub use error::*;
pub use anyhow;

pub use fadroma::prelude::cosmwasm_std;

/// Generate a struct and implement [`ContractHarness`] for the given struct identifier,
/// using the provided entry point functions.
/// 
/// Supports `init`, `execute` and `query` **or**
/// `init`, `execute`, `query` and `reply`.
/// 
/// # Examples
/// 
/// ```
/// # #[macro_use] extern crate fadroma;
/// # use fadroma::{schemars, cosmwasm_std::{Deps, DepsMut, Env, MessageInfo, StdResult, Response, Binary, to_binary}};
/// # #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
/// # pub struct InitMsg;
/// # #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
/// # pub struct ExecuteMsg;
/// # #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
/// # pub struct QueryMsg;
/// pub fn instantiate(
///     _deps: DepsMut,
///     _env: Env,
///     _info: MessageInfo,
///     _msg: InitMsg
/// ) -> StdResult<Response> {
///     Ok(Response::default())
/// }
///
/// pub fn execute(
///     _deps: DepsMut,
///     _env: Env,
///     _info: MessageInfo,
///     _msg: ExecuteMsg
/// ) -> StdResult<Response> {
///     Ok(Response::default())
/// }
///
/// pub fn query(
///     _deps: Deps,
///     _env: Env,
///     _msg: QueryMsg
/// ) -> StdResult<Binary> {
///     to_binary(&true)
/// }
/// 
/// fadroma_ensemble::contract_harness! {
///     pub NameOfStruct,
///     init: instantiate,
///     execute: execute,
///     query: query
/// }
/// ```
#[macro_export]
macro_rules! contract_harness {
    (@init $init:path) => {
        fn instantiate(
            &self,
            deps: $crate::cosmwasm_std::DepsMut,
            env:  $crate::cosmwasm_std::Env,
            info: $crate::cosmwasm_std::MessageInfo,
            msg:  $crate::cosmwasm_std::Binary
        ) -> $crate::AnyResult<$crate::cosmwasm_std::Response> {
            let result = $init(deps, env, info, $crate::cosmwasm_std::from_binary(&msg)?)?;
            Ok(result)
        }
    };

    (@execute $execute:path) => {
        fn execute(
            &self,
            deps: $crate::cosmwasm_std::DepsMut,
            env:  $crate::cosmwasm_std::Env,
            info: $crate::cosmwasm_std::MessageInfo,
            msg:  $crate::cosmwasm_std::Binary
        ) -> $crate::AnyResult<$crate::cosmwasm_std::Response> {
            let result = $execute(deps, env, info, $crate::cosmwasm_std::from_binary(&msg)?)?;
            Ok(result)
        }
    };

    (@query $query:path) => {
        fn query(
            &self,
            deps: $crate::cosmwasm_std::Deps,
            env:  $crate::cosmwasm_std::Env,
            msg:  $crate::cosmwasm_std::Binary
        ) -> $crate::AnyResult<$crate::cosmwasm_std::Binary> {
            let result = $query(deps, env, $crate::cosmwasm_std::from_binary(&msg)?)?;
            Ok(result)
        }
    };

    (@reply $reply:path) => {
        fn reply(
            &self,
            deps:  $crate::cosmwasm_std::DepsMut,
            env:   $crate::cosmwasm_std::Env,
            reply: $crate::cosmwasm_std::Reply
        ) -> $crate::AnyResult<$crate::cosmwasm_std::Response> {
            let result = $reply(deps, env, reply)?;
            Ok(result)
        }
    };

    (@trait_impl $visibility:vis $name:ident, $($contents:tt)*) => {
        $visibility struct $name;

        impl $crate::ContractHarness for $name {
            $($contents)*
        }
    };

    (
        $visibility:vis $name:ident,
        init: $init:path,
        execute: $execute:path,
        query: $query:path,
        reply: $reply:path
    ) => {
        $crate::contract_harness! {
            @trait_impl
            $visibility $name,
            $crate::contract_harness!(@init $init);
            $crate::contract_harness!(@execute $execute);
            $crate::contract_harness!(@query $query);
            $crate::contract_harness!(@reply $reply);
        }
    };

    (
        $visibility:vis $name:ident,
        init: $init:path,
        execute: $execute:path,
        query: $query:path
    ) => {
        $crate::contract_harness! {
            @trait_impl
            $visibility $name,
            $crate::contract_harness!(@init $init);
            $crate::contract_harness!(@execute $execute);
            $crate::contract_harness!(@query $query);
        }
    };
}

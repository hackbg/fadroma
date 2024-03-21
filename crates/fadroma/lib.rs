//! # Note on network support
//! Fadroma currently only supports Secret Network flavoured CosmWasm.
//! As such, you **MUST** enable the `scrt` feature flag. Otherwise,
//! you will get compilation errors - this is by design.

#[cfg(not(feature = "scrt"))]
std::compile_error!("Fadroma only currently supports Secret Network so the \"scrt\" feature must be enabled.");

#[cfg(feature = "scrt")]
pub use secret_cosmwasm_std as cosmwasm_std;
pub use schemars;
pub use serde;

pub mod bin_serde;
pub mod core;

#[cfg(feature = "scrt")]
pub mod scrt;

pub mod tokens;
pub use fadroma_dsl as dsl;
pub mod killswitch;
pub mod admin;
#[cfg(feature = "crypto")]
pub mod crypto;

// Storage helpers
pub mod storage;

// Testing system
#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

/// **Start here.** `use fadroma::prelude::*` to get the essentials for
/// writing smart contracts with Fadroma.
pub mod prelude {
    #[cfg(feature = "scrt")]
    pub use crate::cosmwasm_std::{self, *};
    #[cfg(feature = "scrt")]
    pub use crate::scrt::{ResponseExt, to_cosmos_msg, space_pad, BLOCK_SIZE};

    #[cfg(feature = "scrt")]
    /// Alias for `StdResult<()>`.
    pub type UsuallyOk = cosmwasm_std::StdResult<()>;
    #[cfg(feature = "scrt")]
    /// Alias for `StdResult<Option<V>>`.
    pub type Eventually<V> = cosmwasm_std::StdResult<Option<V>>;

    pub use crate::core::*;

    pub use crate::bin_serde::{FadromaSerialize, FadromaDeserialize};

    pub use crate::tokens::*;

    pub use schemars::{self, JsonSchema};

    pub use crate::storage::{
        self, Key, Namespace, CompositeKey, StaticKey, FixedSegmentSizeKey,
        TypedKey, TypedKey2, TypedKey3, TypedKey4, SingleItem, ItemSpace
    };

    #[cfg(feature = "vk")]
    pub use crate::scrt::vk::{ViewingKey, ViewingKeyHashed};

    #[cfg(feature = "permit")]
    pub use crate::scrt::permit::{Permission, Permit};
}

/// Define the `mod wasm` entrypoint for production builds,
/// using the provided entry point functions.
/// 
/// Supports `init`, `execute` and `query` **or**
/// `init`, `execute`, `query` and `reply`.
/// 
/// Note that Fadroma DSL already handles this for you and
/// as such this macro is not needed when using it.
/// 
/// # Examples
/// 
/// ```
/// # #[macro_use] extern crate fadroma;
/// # use fadroma::cosmwasm_std::{Deps, DepsMut, Env, MessageInfo, StdResult, Response, Binary, to_binary};
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
/// entrypoint! {
///     init: instantiate,
///     execute: execute,
///     query: query
/// }
/// ```
#[macro_export]
macro_rules! entrypoint {
    (@init $($init:ident)::+) => {
        #[no_mangle]
        extern "C" fn instantiate(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
            $crate::cosmwasm_std::do_instantiate(&super::$($init)::+, env_ptr, info_ptr, msg_ptr)
        }
    };

    (@execute $($execute:ident)::+) => {
        #[no_mangle]
        extern "C" fn execute(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
            $crate::cosmwasm_std::do_execute(&super::$($execute)::+, env_ptr, info_ptr, msg_ptr)
        }
    };

    (@query $($query:ident)::+) => {
        #[no_mangle]
        extern "C" fn query(env_ptr: u32, msg_ptr: u32) -> u32 {
            $crate::cosmwasm_std::do_query(&super::$($query)::+, env_ptr, msg_ptr)
        }
    };

    (@reply $($reply:ident)::+) => {
        #[no_mangle]
        extern "C" fn reply(env_ptr: u32, msg_ptr: u32) -> u32 {
            $crate::cosmwasm_std::do_reply(&super::$($reply)::+, env_ptr, msg_ptr)
        }
    };

    (@wasm_mod $($contents:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            $($contents)*
        }
    };

    (
        init: $($init:ident)::+,
        execute: $($execute:ident)::+,
        query: $($query:ident)::+
        $(, reply: $($reply:ident)::+)?
    ) => {
        $crate::entrypoint! {
            @wasm_mod
            $crate::entrypoint!(@init    $($init)::+);
            $crate::entrypoint!(@execute $($execute)::+);
            $crate::entrypoint!(@query   $($query)::+);
            $($crate::entrypoint!(@reply $($reply)::+);)?
        }
    };
}

#[macro_export] macro_rules! contract {
    ($($body:item)*) => {
        pub use contract::*;

        #[fadroma::dsl::contract]
        pub mod contract {
            use super::*;
            use fadroma::{prelude::*, dsl::*};
            impl Contract {
                $($body)*
            }
        }
    }
}

#[macro_export] macro_rules! message {
    ($structOrEnum:item) => {
        #[derive(Serialize, Deserialize, JsonSchema)]
        #[serde(rename_all = "snake_case")]
        $structOrEnum
    }
}

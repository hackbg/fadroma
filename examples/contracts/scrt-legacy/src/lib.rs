#[cfg(target_arch="wasm32")]
mod wasm {
    use secret_cosmwasm_std::{ExternalApi, ExternalQuerier, ExternalStorage};
    #[no_mangle]
    extern "C" fn init(env_ptr: u32, msg_ptr: u32) -> u32 {
        secret_cosmwasm_std::do_init(
            &super::init::<ExternalStorage, ExternalApi, ExternalQuerier>,
            env_ptr,
            msg_ptr,
        )
    }
    #[no_mangle]
    extern "C" fn handle(env_ptr: u32, msg_ptr: u32) -> u32 {
        secret_cosmwasm_std::do_handle(
            &super::handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
            env_ptr,
            msg_ptr,
        )
    }
    #[no_mangle]
    extern "C" fn query(msg_ptr: u32) -> u32 {
        secret_cosmwasm_std::do_query(
            &super::query::<ExternalStorage, ExternalApi, ExternalQuerier>,
            msg_ptr,
        )
    }
    // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
    // automatically because we `use cosmwasm_std`.
}

use secret_cosmwasm_std::*;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct InitMsg {
    hello: Option<String>
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub enum HandleMsg {
    Hello { world: Option<String> }
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub enum QueryMsg {
    Hello { world: Option<String> }
}

pub fn init<S: Storage, A: Api, Q: Querier>(deps: &mut Extern<S, A, Q>, env: Env, msg: InitMsg)
    -> StdResult<InitResponse>
{
    Ok(InitResponse::default())
}

pub fn handle<S: Storage, A: Api, Q: Querier>(deps: &mut Extern<S, A, Q>, env: Env, msg: HandleMsg)
    -> StdResult<HandleResponse>
{
    Ok(HandleResponse::default())
}

pub fn query<S: Storage, A: Api, Q: Querier>(deps: &Extern<S, A, Q>, msg: HandleMsg)
    -> QueryResult
{
    to_binary(&"hello")
}

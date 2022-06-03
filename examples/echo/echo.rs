use fadroma::*;

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct InitMsg { fail: bool }
pub(crate) fn init<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: InitMsg,
) -> StdResult<InitResponse> {
    if !msg.fail {
        let mut response = InitResponse::default();
        response.log.push(LogAttribute {
            key:       "Echo".into(),
            value:     to_binary(&msg)?.to_base64(),
            encrypted: false
        });
        Ok(response)
    } else {
        Err(StdError::generic_err("caller requested the init to fail"))
    }
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub enum HandleMsg { Echo, Fail }
pub(crate) fn handle<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: HandleMsg,
) -> StdResult<HandleResponse> {
    match msg {
        HandleMsg::Echo => {
            let mut response = HandleResponse::default();
            response.data = Some(to_binary(&msg)?);
            Ok(response)
        },
        HandleMsg::Fail => {
            Err(StdError::generic_err("this transaction always fails"))
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub enum QueryMsg { Echo, Fail }
pub(crate) fn query<S: Storage, A: Api, Q: Querier>(
    _deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Echo => to_binary(&msg),
        QueryMsg::Fail => Err(StdError::generic_err("this query always fails"))
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use fadroma::platform::{
        do_handle, do_init, do_query, ExternalApi, ExternalQuerier, ExternalStorage,
    };
    #[no_mangle]
    extern "C" fn init(env_ptr: u32, msg_ptr: u32) -> u32 {
        do_init(&super::init::<ExternalStorage, ExternalApi, ExternalQuerier>, env_ptr, msg_ptr,)
    }
    #[no_mangle]
    extern "C" fn handle(env_ptr: u32, msg_ptr: u32) -> u32 {
        do_handle(&super::handle::<ExternalStorage, ExternalApi, ExternalQuerier>, env_ptr, msg_ptr,)
    }
    #[no_mangle]
    extern "C" fn query(msg_ptr: u32) -> u32 {
        do_query(&super::query::<ExternalStorage, ExternalApi, ExternalQuerier>, msg_ptr)
    }
}

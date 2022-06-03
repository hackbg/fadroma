use fadroma::{
    Storage, Api, Querier,
    Extern, Env,
    InitResponse, HandleResponse, Binary,
    StdResult,
    schemars,
    to_binary,
    to_vec,
    LogAttribute
};

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct InitMsg {}
pub(crate) fn init<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: InitMsg,
) -> StdResult<InitResponse> {
    let mut response = InitResponse::default();
    response.log.push(LogAttribute {
        key:       "echo".into(),
        value:     to_binary(&msg)?.to_base64(),
        encrypted: false
    });
    Ok(response)
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub enum HandleMsg { Echo }
pub(crate) fn handle<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: HandleMsg,
) -> StdResult<HandleResponse> {
    let mut response = HandleResponse::default();
    response.data = Some(to_binary(&msg)?);
    Ok(response)
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub enum QueryMsg { Echo }
pub(crate) fn query<S: Storage, A: Api, Q: Querier>(
    _deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    to_binary(&msg)
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

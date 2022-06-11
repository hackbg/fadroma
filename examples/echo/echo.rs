use fadroma::prelude::*;

#[message] pub struct InitMsg { fail: bool }

#[message] pub enum HandleMsg {
    /// Return the input message as the .data property of the response
    Echo,
    /// Return an error
    Fail
}

#[message] pub enum QueryMsg {
    /// Return the input message
    Echo,
    /// Return an error
    Fail
}

pub fn init<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: InitMsg,
) -> StdResult<InitResponse> {
    if !msg.fail {
        InitResponse::default().log("Echo", &to_binary(&msg)?.to_base64())
    } else {
        Err(StdError::generic_err("caller requested the init to fail"))
    }
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    _deps: &mut Extern<S, A, Q>, _env: Env, msg: HandleMsg,
) -> StdResult<HandleResponse> {
    match msg {
        HandleMsg::Echo => HandleResponse::default().data(&msg),
        HandleMsg::Fail => Err(StdError::generic_err("this transaction always fails"))
    }
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    _deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Echo => to_binary(&msg),
        QueryMsg::Fail => Err(StdError::generic_err("this query always fails"))
    }
}

fadroma::entrypoint!(fadroma, init, handle, query);

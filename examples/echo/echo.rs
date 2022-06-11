use fadroma::prelude::*;

fadroma::entrypoint!(fadroma, init, handle, query);

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct InitMsg { fail: bool }

pub fn init<S: Storage, A: Api, Q: Querier>(
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
pub enum HandleMsg {
    /// Return the input message as the .data property of the response
    Echo,
    /// Return an error
    Fail
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
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
pub enum QueryMsg {
    /// Return the input message
    Echo,
    /// Return an error
    Fail
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    _deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Echo => to_binary(&msg),
        QueryMsg::Fail => Err(StdError::generic_err("this query always fails"))
    }
}

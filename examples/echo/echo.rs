use fadroma::prelude::*;

/// Initial configuration of the contract.
/// In this example, you can ask the instantiation to fail.
#[message] pub struct InitMsg { fail: bool }

/// Transactions that this contract supports.
#[message] pub enum HandleMsg {
    /// Return the input message as the .data property of the response
    Echo,
    /// Return an error
    Fail
}

/// Queries that this contract supports.
#[message] pub enum QueryMsg {
    /// Return the input message
    Echo,
    /// Return an error
    Fail
}

pub fn instantiate(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InitMsg
) -> StdResult<Response> {
    if !msg.fail {
        Ok(Response::default().add_attribute("Echo", &to_binary(&msg)?.to_base64()))
    } else {
        Err(StdError::generic_err("caller requested the init to fail"))
    }
}

pub fn execute(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: HandleMsg
) -> StdResult<Response> {
    match msg {
        HandleMsg::Echo => {
            let mut resp = Response::default();
            resp.data = Some(to_binary(&msg)?);

            Ok(resp)
        },
        HandleMsg::Fail => Err(StdError::generic_err("this transaction always fails"))
    }
}

pub fn query(
    _deps: Deps,
    _env: Env,
    msg: QueryMsg
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Echo => to_binary(&msg),
        QueryMsg::Fail => Err(StdError::generic_err("this query always fails"))
    }
}

fadroma::entrypoint!(fadroma, instantiate, execute, query);

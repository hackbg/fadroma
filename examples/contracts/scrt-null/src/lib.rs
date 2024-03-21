use fadroma::{cosmwasm_std::*};
use serde::Deserialize;

#[derive(Deserialize)] pub struct InstantiateMsg;
#[derive(Deserialize)] pub struct ExecuteMsg;
#[derive(Deserialize)] pub struct QueryMsg;

pub fn instantiate(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Ok(Response::default())
}

pub fn execute(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: ExecuteMsg,
) -> Result<Response, StdError> {
    Ok(Response::default())
}

pub fn query(
    _deps: Deps, _env: Env, _msg: QueryMsg,
) -> Result<QueryResponse, StdError> {
    Ok("null".as_bytes().into())
}

fadroma::entrypoint! {
    init:    instantiate,
    execute: execute,
    query:   query
}

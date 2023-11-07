use fadroma::{cosmwasm_std::*};
use serde::Deserialize;

#[derive(Deserialize)] pub struct InstantiateMsg;
#[derive(Deserialize)] pub struct ExecuteMsg;
#[derive(Deserialize)] pub struct QueryMsg;

pub fn instantiate(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

pub fn execute(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: ExecuteMsg,
) -> Result<Response, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

pub fn query(
    _deps: Deps, _env: Env, _msg: QueryMsg,
) -> Result<QueryResponse, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

fadroma::entrypoint! {
    init:    instantiate,
    execute: execute,
    query:   query
}

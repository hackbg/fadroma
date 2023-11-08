extern crate cosmwasm_std;
use cosmwasm_std::*;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct InstantiateMsg;

#[entry_point]
pub fn instantiate(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

#[derive(Deserialize)]
pub struct ExecuteMsg;

#[entry_point]
pub fn execute(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: ExecuteMsg,
) -> Result<Response, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

#[derive(Deserialize)]
pub struct QueryMsg;

#[entry_point]
pub fn query(
    _deps: Deps, _env: Env, _msg: QueryMsg,
) -> Result<QueryResponse, StdError> {
    Err(StdError::generic_err("This contract is not available on this chain."))
}

extern crate cosmwasm_std;
use cosmwasm_std::*;
use serde::Deserialize;
use schemars::JsonSchema;

#[derive(Deserialize, JsonSchema)]
pub struct InstantiateMsg;

#[entry_point]
pub fn instantiate(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Ok(Response::default())
}

#[derive(Deserialize, JsonSchema)]
pub struct ExecuteMsg;

#[entry_point]
pub fn execute(
    _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: ExecuteMsg,
) -> Result<Response, StdError> {
    Ok(Response::default())
}

#[derive(Deserialize, JsonSchema)]
pub struct QueryMsg;

#[entry_point]
pub fn query(
    _deps: Deps, _env: Env, _msg: QueryMsg,
) -> Result<QueryResponse, StdError> {
    Ok("null".as_bytes().into())
}

extern crate cosmwasm_std;
use cosmwasm_std::*;
use serde::Deserialize;
use schemars::JsonSchema;

#[derive(Deserialize, JsonSchema)]
pub struct InstantiateMsg(String);

#[entry_point]
pub fn instantiate(
    _: DepsMut, _: Env, _: MessageInfo, msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Ok(Response::default().add_attribute("echo", &msg.0))
}

#[derive(Deserialize, JsonSchema)]
pub struct ExecuteMsg(String);

#[entry_point]
pub fn execute(_: DepsMut, _: Env, _: MessageInfo, msg: ExecuteMsg) -> Result<Response, StdError> {
    Ok(Response::default().add_attribute("echo", &msg.0))
}

#[derive(Deserialize, JsonSchema)]
pub struct QueryMsg(String);

#[entry_point]
pub fn query(_: Deps, _: Env, msg: QueryMsg) -> Result<QueryResponse, StdError> {
    Ok(msg.0.as_bytes().into())
}

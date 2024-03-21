extern crate secret_cosmwasm_std;
use secret_cosmwasm_std::*;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct InstantiateMsg(String);

#[entry_point]
pub fn instantiate(
    _: DepsMut, _: Env, _: MessageInfo, msg: InstantiateMsg,
) -> Result<Response, StdError> {
    Ok(Response::default().add_attribute("echo", &msg.0))
}

#[derive(Deserialize)]
pub struct ExecuteMsg(String);

#[entry_point]
pub fn execute(_: DepsMut, _: Env, _: MessageInfo, msg: ExecuteMsg) -> Result<Response, StdError> {
    Ok(Response::default().add_attribute("echo", &msg.0))
}

#[derive(Deserialize)]
pub struct QueryMsg(String);

#[entry_point]
pub fn query(_: Deps, _: Env, msg: QueryMsg) -> Result<QueryResponse, StdError> {
    Ok(msg.0.as_bytes().into())
}

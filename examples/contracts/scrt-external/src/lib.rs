/// 
/// fadroma::contract! {
///     #[init(entry)]
///     pub fn new () -> Result<Response, StdError> {
///         Ok(Response::default())
///     }
/// 
///     #[execute]
///     pub fn execute_nothing () -> Result<Response, StdError> {
///         Ok(Response::default())
///     }
/// 
///     #[query]
///     pub fn query_nothing () -> Result<(), StdError> {
///         Ok(())
///     }
/// }
///

use cosmwasm_std::*;

#[entry_point]
pub fn instantiate(
    _deps: DepsMut,
    _env:  Env,
    _info: MessageInfo,
    _msg:  InstantiateMsg,
) -> StdResult<Response> {
    Ok(Response::default())
}

#[derive(serde::Deserialize)]
pub struct InstantiateMsg {}

#[entry_point]
pub fn execute(
    _deps: DepsMut,
    _env:  Env,
    _info: MessageInfo,
    _msg:  ExecuteMsg
) -> StdResult<Response> {
    Ok(Response::default())
}

#[derive(serde::Deserialize)]
pub enum ExecuteMsg {}

#[entry_point]
pub fn query(
    _deps: Deps,
    _env: Env,
    _msg:  QueryMsg
) -> StdResult<Binary> {
    to_binary("")
}

#[derive(serde::Deserialize)]
pub enum QueryMsg {}

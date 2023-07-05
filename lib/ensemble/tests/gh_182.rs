//! https://github.com/hackbg/fadroma/issues/182
//!
//! > I have a fairly complex operation which when I execute it in Contract A, will instantiate two Contracts B & C.
//! > Contract C relies on B. So Contract A will wait for the reply of the Contract B instantiation.
//! > Then from the reply it will launch another submessage to instantiate Contract C.
//! > Contract A then waits for the reply of Contract C.
//! > Finally Contract A will return a response after Contract C replies with the addresses of both Contract B & C.
//! > The data set by Contract A from the final reply from Contract C is not being returned in the response in Ensemble:
//! > [screenshot omitted]
//! > It is picking the wrong index and setting the data of state[1] when I think it should be overwriting the data in state[0]

use serde::{Deserialize, Serialize};
use crate::{prelude::*, ensemble::AnyResult};

#[test] fn test_gh_182 () {
    let mut ensemble = crate::ensemble::ContractEnsemble::new();
}

struct ContractA;
struct ContractB;
struct ContractC;

#[derive(Serialize, Deserialize)]
struct InstantiateMsg {
    contract_b_address: CanonicalAddr
}

#[derive(Serialize, Deserialize)]
enum ExecuteMsg {
    InstantiateBC {}
}

#[derive(Serialize, Deserialize)]
enum QueryMsg {}

impl crate::ensemble::ContractHarness for ContractA {
    fn instantiate(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;
        Ok(Response::default())
    }
    fn query (&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

impl crate::ensemble::ContractHarness for ContractB {
    fn instantiate(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        unreachable!();
    }
    fn query (&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

impl crate::ensemble::ContractHarness for ContractC {
    fn instantiate(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        unreachable!();
    }
    fn query (&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

#![cfg(test)]

use fadroma::{prelude::*, ensemble::*};
use serde::{Deserialize, Serialize};

pub struct Oracle;

#[derive(Serialize, Deserialize)]
pub enum OracleQuery {
    GetPrice { base_symbol: String },
}

// Fadroma ensemble allows to create custom implementations for test purposes
// Here we create an implementation for an Oracle contract
impl ContractHarness for Oracle {
    fn instantiate(
        &self,
        _deps: DepsMut,
        _env: Env,
        _info: MessageInfo, 
        _msg: Binary
    ) -> AnyResult<Response> {
        Ok(Response::default())
    }

    fn execute(
        &self, 
        _deps: DepsMut,
        _env: Env,
        _info: MessageInfo,
        _msg: Binary
    ) -> AnyResult<Response> {
        Err(anyhow::Error::new(StdError::generic_err("Not Implemented")))
    }

    fn query(
        &self,
        _deps: Deps,
        _env: Env,
        msg: Binary
    ) -> AnyResult<Binary> {
        let msg = from_binary(&msg).unwrap();
        let result = match msg {
            OracleQuery::GetPrice { base_symbol: _, .. } => to_binary(&Uint128::new(1_000_000_000))?,
        };

        Ok(result)
    }
}

fadroma::contract_harness!(
    TestContract,
    init: counter::instantiate,
    execute: counter::execute,
    query: counter::query
);

#[test]
fn test_contracts() {
    let mut ensemble = ContractEnsemble::new();

    let oracle = ensemble.register(Box::new(Oracle));
    let test_contract = ensemble.register(Box::new(TestContract));

    let oracle = ensemble
        .instantiate(
            oracle.id,
            &{},
            MockEnv::new("admin", "oracle")
        )
        .unwrap()
        .instance;

    let test_contract = ensemble
        .instantiate(
            test_contract.id,
            &counter::InstantiateMsg { initial_value: 10 },
            MockEnv::new("admin", "test")
        )
        .unwrap()
        .instance;

    let oracle_res: Uint128 = ensemble
        .query(
            oracle.address,
            &OracleQuery::GetPrice {
                base_symbol: "SCRT".into(),
            },
        )
        .unwrap();

    // should return value hardcoded in the ContractHarness
    assert_eq!(oracle_res, Uint128::new(1_000_000_000));

    let value: u64 = ensemble
        .query(
            test_contract.address.clone(),
            &counter::QueryMsg::Value { },
        )
        .unwrap();
    // should return value assigned in instantiate
    assert_eq!(value, 10);

    ensemble.execute(
        &counter::ExecuteMsg::Add { value: 55 },
        MockEnv::new("admin", test_contract.address.clone()),
    ).unwrap();

    let value: u64 = ensemble.query(
        test_contract.address.clone(),
        &counter::QueryMsg::Value { },
    ).unwrap();

    assert_eq!(value, 65);
}

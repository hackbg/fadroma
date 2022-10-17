use fadroma::{prelude::*, ensemble::*};
use serde::{Deserialize, Serialize};

use fadroma_example_derive_contract_interface as derive_contract_interface;

pub struct Oracle;

#[derive(Serialize, Deserialize)]
pub enum OracleQuery {
    GetPrice { base_symbol: String },
}

// Fadroma ensemble allows to create custom implementations for test purposes
// Here we create an implementation for an Oracle contract
impl ContractHarness for Oracle {
    fn instantiate(
        &self, _deps: &mut MockDeps,
        _env: Env,
        _info: MessageInfo, 
        _msg: Binary
    ) -> AnyResult<Response> {
        Ok(Response::default())
    }

    fn execute(
        &self, 
        _deps: &mut MockDeps,
        _env: Env,
        _info: MessageInfo,
        _msg: Binary
    ) -> AnyResult<Response> {
        Err(anyhow::Error::new(StdError::generic_err("Not Implemented")))
    }

    fn query(
        &self,
        _deps: &MockDeps,
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

// Create a ContractHarness implementation for some existing contract
pub struct TestContract;

impl ContractHarness for TestContract {
    fn instantiate(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        derive_contract_interface::instantiate(
            deps.as_mut(),
            env,
            info,
            from_binary(&msg)?,
            derive_contract_interface::DefaultImpl,
        ).map_err(|e| e.into())
    }

    fn execute(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let result = match from_binary(&msg).unwrap() {
            derive_contract_interface::interface::ExecuteMsg::Add { value: _ } => {
                Err(StdError::GenericErr {
                    msg: "Not implemented for test".to_string(),
                })
            }
            _ => derive_contract_interface::execute(
                deps.as_mut(),
                env,
                info,
                from_binary(&msg)?,
                derive_contract_interface::DefaultImpl,
            ),
        }?;

        Ok(result)
    }

    fn query(&self, deps: &MockDeps, env: Env, msg: Binary) -> AnyResult<Binary> {
        derive_contract_interface::query(
            deps.as_ref(),
            env,
            from_binary(&msg)?,
            derive_contract_interface::DefaultImpl,
        ).map_err(|e| e.into())
    }
}

#[test]
fn test_contracts() {
    let mut ensemble = ContractEnsemble::new();
    let oracle = ensemble.register(Box::new(Oracle));
    let test_contract = ensemble.register(Box::new(TestContract));

    let oracle = ensemble
        .instantiate(
            oracle,
            &{},
            MockEnv::new("Admin", "oracle")
        )
        .unwrap()
        .instance;

    let test_contract = ensemble
        .instantiate(
            test_contract,
            &derive_contract_interface::interface::InstantiateMsg { initial_value: 10 },
            MockEnv::new("Admin", "test")
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

    let derive_contract_interface::interface::StateResponse { value } = ensemble
        .query(
            test_contract.address.clone(),
            &derive_contract_interface::interface::QueryMsg::State {},
        )
        .unwrap();
    // should return value assigned in instantiate
    assert_eq!(value, 10);

    let res = ensemble.execute(
        &derive_contract_interface::interface::ExecuteMsg::Add { value: 55 },
        MockEnv::new("Admin", test_contract.address.clone()),
    );

    // the method was overriden in the ContractHarness
    assert_eq!(
        res.unwrap_err().unwrap_contract_error().downcast::<StdError>().unwrap(),
        StdError::generic_err("Not implemented for test")
    )
}

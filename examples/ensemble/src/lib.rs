use fadroma::{
    cosmwasm_std::{
        from_binary, to_binary, Binary, Env, HandleResponse, InitResponse, StdError, StdResult,
        Uint128,
    },
    ensemble::*,
};

use serde::{Deserialize, Serialize};

use derive_contract_interface;

pub struct Oracle;

#[derive(Serialize, Deserialize)]
pub enum OracleQuery {
    GetPrice { base_symbol: String },
}

// Fadroma ensemble allows to create custom implementations for test purposes
// Here we create an implementation for an Oracle contract
impl ContractHarness for Oracle {
    fn init(&self, _deps: &mut MockDeps, _env: Env, _msg: Binary) -> StdResult<InitResponse> {
        Ok(InitResponse::default())
    }

    fn handle(&self, _deps: &mut MockDeps, _env: Env, _msg: Binary) -> StdResult<HandleResponse> {
        Err(StdError::GenericErr {
            msg: "Not Implemented".to_string(),
            backtrace: None,
        })
    }

    // Override with some hardcoded value for the ease of testing
    fn query(&self, _deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
        let msg = from_binary(&msg).unwrap();
        match msg {
            OracleQuery::GetPrice { base_symbol: _, .. } => to_binary(&Uint128(1_000_000_000)),
        }
    }
}

// Create a ContractHarness implementation for some existing contract
pub struct TestContract;
impl ContractHarness for TestContract {
    // Use the method from the default implementation
    fn init(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<InitResponse> {
        derive_contract_interface::init(
            deps,
            env,
            from_binary(&msg)?,
            derive_contract_interface::DefaultImpl,
        )
    }

    // Fadroma ensemble allows to override methods
    fn handle(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<HandleResponse> {
        match from_binary(&msg).unwrap() {
            derive_contract_interface::interface::HandleMsg::Add { value: _ } => {
                Err(StdError::GenericErr {
                    msg: "Not implemented for test".to_string(),
                    backtrace: None,
                })
            }
            _ => derive_contract_interface::handle(
                deps,
                env,
                from_binary(&msg)?,
                derive_contract_interface::DefaultImpl,
            ),
        }
    }

    fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
        derive_contract_interface::query(
            deps,
            from_binary(&msg)?,
            derive_contract_interface::DefaultImpl,
        )
    }
}

#[test]
fn test_contracts() {
    use fadroma::ContractLink;
    let mut ensemble = ContractEnsemble::new(50);
    let oracle = ensemble.register(Oracle);
    let test_contract = ensemble.register(TestContract);

    let oracle = ensemble
        .instantiate(
            oracle.id,
            &{},
            MockEnv::new(
                "Admin",
                ContractLink {
                    address: "oracle".into(),
                    code_hash: oracle.code_hash,
                },
            ),
        )
        .unwrap();

    let test_contract = ensemble
        .instantiate(
            test_contract.id,
            &derive_contract_interface::interface::InitMsg { initial_value: 10 },
            MockEnv::new(
                "Admin",
                ContractLink {
                    address: "test".into(),
                    code_hash: test_contract.code_hash,
                },
            ),
        )
        .unwrap();

    let oracle_res: Uint128 = ensemble
        .query(
            oracle.address,
            &OracleQuery::GetPrice {
                base_symbol: "SCRT".into(),
            },
        )
        .unwrap();

    // should return value hardcoded in the ContractHarness
    assert_eq!(oracle_res, Uint128(1_000_000_000));

    let derive_contract_interface::interface::StateResponse { value } = ensemble
        .query(
            test_contract.address.clone(),
            &derive_contract_interface::interface::QueryMsg::State {},
        )
        .unwrap();
    // should return value assigned in instantiate
    assert_eq!(value, 10);

    let res = ensemble.execute(
        &derive_contract_interface::interface::HandleMsg::Add { value: 55 },
        MockEnv::new("Admin", test_contract),
    );

    // the method was overriden in the ContractHarness
    assert_eq!(
        res.unwrap_err(),
        StdError::GenericErr {
            msg: "Not implemented for test".to_string(),
            backtrace: None,
        }
    )
}

use fadroma::{
    admin,
    killswitch,
    cosmwasm_std::{
        Deps, DepsMut, Env, MessageInfo, StdResult,
        Response, Binary, entry_point
    },
    schemars::{self, JsonSchema}
};

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct InstantiateMsg {
    counter: counter::InstantiateMsg,
    admin: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Counter(counter::ExecuteMsg),
    Admin(admin::simple::ExecuteMsg),
    Killswitch(killswitch::ExecuteMsg)
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Counter(counter::QueryMsg),
    Admin(admin::simple::QueryMsg),
    Killswitch(killswitch::QueryMsg)
}

#[entry_point]
pub fn instantiate(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // The admin module is required by killswitch, though
    // the killswitch module itself needs no setup.
    admin::init(deps.branch(), msg.admin.as_deref(), &info)?;

    counter::instantiate(deps, env, info, msg.counter, counter::DefaultImpl)
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    // If we are not trying to change the contract status
    // we must assert that the contract wasn't paused or migrated.
    if !matches!(msg, ExecuteMsg::Killswitch(_)) {
        killswitch::assert_is_operational(deps.as_ref())?;
    }

    match msg {
        ExecuteMsg::Admin(msg) => admin::simple::execute(
            deps,
            env,
            info,
            msg,
            admin::simple::DefaultImpl
        ),
        ExecuteMsg::Counter(msg) => counter::execute(
            deps,
            env,
            info,
            msg,
            counter::DefaultImpl
        ),
        ExecuteMsg::Killswitch(msg) => killswitch::execute(
            deps,
            env,
            info,
            msg,
            killswitch::DefaultImpl
        )
    }
}

#[entry_point]
pub fn query(
    deps: Deps,
    env: Env,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Admin(msg) => admin::simple::query(
            deps,
            env,
            msg,
            admin::simple::DefaultImpl
        ),
        QueryMsg::Counter(msg) => counter::query(
            deps,
            env,
            msg,
            counter::DefaultImpl,
        ),
        QueryMsg::Killswitch(msg) => killswitch::query(
            deps,
            env,
            msg,
            killswitch::DefaultImpl
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use fadroma::{
        cosmwasm_std::Addr,
        killswitch::{ContractStatus, ContractStatusLevel},
        ensemble::{ContractEnsemble, MockEnv}
    };

    fadroma::impl_contract_harness!(KillswitchTest, super);

    #[test]
    fn test_killswitch() {
        let admin = "admin";

        let mut ensemble = ContractEnsemble::new();

        let counter = ensemble.register(Box::new(KillswitchTest));
        let counter = ensemble.instantiate(
            counter.id,
            &InstantiateMsg {
                admin: None,
                counter: counter::InstantiateMsg {
                    initial_value: 10
                }
            },
            MockEnv::new(admin, "counter")
        )
        .unwrap()
        .instance;

        let status: ContractStatus<Addr> = ensemble.query(
            &counter.address,
            &QueryMsg::Killswitch(killswitch::QueryMsg::Status { })
        ).unwrap();

        assert_eq!(status, ContractStatus::default());

        ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Add { value: 1 }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let error = ensemble.execute(
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: ContractStatusLevel::Paused,
                reason: String::new(),
                new_address: None
            }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap_err();

        assert_eq!(error.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        ensemble.execute(
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: ContractStatusLevel::Paused,
                reason: "Test".into(),
                new_address: None
            }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let status: ContractStatus<Addr> = ensemble.query(
            &counter.address,
            &QueryMsg::Killswitch(killswitch::QueryMsg::Status { })
        ).unwrap();

        assert_eq!(status.level, ContractStatusLevel::Paused);

        let error = ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Add { value: 1 }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap_err();

        assert_eq!(
            error.unwrap_contract_error().to_string(),
            "Generic error: This contract has been paused. Reason: Test"
        );

        ensemble.execute(
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: ContractStatusLevel::Operational,
                reason: String::new(),
                new_address: None
            }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let status: ContractStatus<Addr> = ensemble.query(
            &counter.address,
            &QueryMsg::Killswitch(killswitch::QueryMsg::Status { })
        ).unwrap();

        assert_eq!(status, ContractStatus::default());

        ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Add { value: 1 }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let value: u64 = ensemble.query(
            &counter.address,
            &QueryMsg::Counter(counter::QueryMsg::Value { })
        ).unwrap();
        
        assert_eq!(value, 12);
    }
}

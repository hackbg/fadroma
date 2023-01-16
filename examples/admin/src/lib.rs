use fadroma::{
    admin,
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
    Admin(admin::simple::ExecuteMsg)
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Counter(counter::QueryMsg),
    Admin(admin::simple::QueryMsg)
}

#[entry_point]
pub fn instantiate(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    admin::init(deps.branch(), msg.admin.as_deref(), &info)?;

    counter::instantiate(deps, env, info, msg.counter, CounterWithAdmin)
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
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
            CounterWithAdmin
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
            CounterWithAdmin
        )
    }
}

struct CounterWithAdmin;

// Make multiplication and division callable only by admin.
impl counter::Contract for CounterWithAdmin {
    #[admin::require_admin]
    fn mul(
        &self,
        value:u64,
        deps: DepsMut,
        env: Env,
        info: MessageInfo
    ) -> StdResult<Response> {
        counter::Contract::mul(&counter::DefaultImpl, value, deps, env, info)
    }

    #[admin::require_admin]
    fn div(
        &self,
        value:u64,
        deps: DepsMut,
        env: Env,
        info: MessageInfo
    ) -> StdResult<Response> {
        counter::Contract::div(&counter::DefaultImpl, value, deps, env, info)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use fadroma::{
        cosmwasm_std::Addr,
        ensemble::{ContractEnsemble, MockEnv}
    };

    fadroma::impl_contract_harness!(CounterWithAdminTest, super);

    #[test]
    fn test_admin() {
        let admin = "admin";

        let mut ensemble = ContractEnsemble::new();

        let counter = ensemble.register(Box::new(CounterWithAdminTest));
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

        let stored_admin: Option<Addr> = ensemble.query(
            &counter.address,
            &QueryMsg::Admin(admin::simple::QueryMsg::Admin { })
        ).unwrap();

        assert_eq!(stored_admin.unwrap().as_str(), admin);

        let error = ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Mul { value: 2 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap_err();

        assert_eq!(error.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        let error = ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Div { value: 2 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap_err();

        assert_eq!(error.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Add { value: 1 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap();

        let value: u64 = ensemble.query(
            &counter.address,
            &QueryMsg::Counter(counter::QueryMsg::Value { })
        ).unwrap();

        assert_eq!(value, 11);

        ensemble.execute(
            &ExecuteMsg::Counter(counter::ExecuteMsg::Mul { value: 2 }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let value: u64 = ensemble.query(
            &counter.address,
            &QueryMsg::Counter(counter::QueryMsg::Value { })
        ).unwrap();
        
        assert_eq!(value, 22);
    }
}

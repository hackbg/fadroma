use fadroma::{
    admin::{self, Admin},
    cosmwasm_std::{
        Deps, DepsMut, Env, MessageInfo, StdResult,
        Response, Binary, to_binary,
    },
    dsl::*,
    schemars::{self, JsonSchema},
};
use counter::interface::Counter;
use serde::{Serialize, Deserialize};

fadroma::message!(pub struct InstantiateMsg {
    counter: counter::interface::InstantiateMsg,
    admin: Option<String>
});

fadroma::message!(pub enum ExecuteMsg {
    Counter(counter::interface::ExecuteMsg),
    Admin(admin::ExecuteMsg)
});

fadroma::message!(pub enum QueryMsg {
    Counter(counter::interface::QueryMsg),
    Admin(admin::QueryMsg)
});

pub fn instantiate(
    mut deps: DepsMut, env: Env, info: MessageInfo, msg: InstantiateMsg,
) -> StdResult<Response> {
    admin::init(deps.branch(), msg.admin.as_deref(), &info)?;

    counter_admin::Contract::new(deps, env, info, msg.counter.initial_value)
}

pub fn execute(
    deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::Admin(msg) => match msg {
            admin::ExecuteMsg::ChangeAdmin { mode } =>
                admin::DefaultImpl::change_admin(
                    deps,
                    env,
                    info,
                    mode
                )
        }
        ExecuteMsg::Counter(msg) => match msg {
            counter::interface::ExecuteMsg::Add { value } =>
                counter_admin::Contract::add(deps, env, info, value),
            counter::interface::ExecuteMsg::Sub { value } =>
                counter_admin::Contract::sub(deps, env, info, value),
            counter::interface::ExecuteMsg::Mul { value } =>
                counter_admin::Contract::mul(deps, env, info, value),
            counter::interface::ExecuteMsg::Div { value } =>
                counter_admin::Contract::div(deps, env, info, value),
        }
    }
}

pub fn query(
    deps: Deps, env: Env, msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Admin(msg) => match msg {
            admin::QueryMsg::Admin {  } => {
                let admin = admin::DefaultImpl::admin(deps, env)?;

                to_binary(&admin)
            }
        }
        QueryMsg::Counter(msg) => match msg {
            counter::interface::QueryMsg::Value { } => {
                let result = counter_admin::Contract::value(deps, env)?;

                to_binary(&result)
            }
        }
    }
}

#[contract]
mod counter_admin {
    use fadroma::cosmwasm_std;
    use counter::interface::Counter;

    use super::*;

    #[auto_impl(counter::Contract)]
    impl Counter for Contract {
        #[init]
        fn new(initial_value: u64) -> Result<Response, Self::Error> { }
    
        #[execute]
        fn add(value: u64) -> Result<Response, Self::Error> { }
    
        #[execute]
        fn sub(value: u64) -> Result<Response, Self::Error> { }
    
        // Make multiplication and division callable only by admin.

        #[execute]
        #[admin::require_admin]
        fn mul(value: u64) -> Result<Response, Self::Error> {
            counter::Contract::mul(deps, env, info, value)
        }
    
        #[execute]
        #[admin::require_admin]
        fn div(value: u64) -> Result<Response, Self::Error> {
            counter::Contract::div(deps, env, info, value)
        }
    
        #[query]
        fn value() -> Result<u64, Self::Error> { }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma::cosmwasm_std::Addr;
    use fadroma_ensemble::{ContractEnsemble, MockEnv};
    fadroma_ensemble::contract_harness!(
        CounterWithAdminTest,
        init: super::instantiate,
        execute: super::execute,
        query: super::query
    );

    #[test]
    fn test_admin() {
        let admin = "admin";

        let mut ensemble = ContractEnsemble::new();

        let counter = ensemble.register(Box::new(CounterWithAdminTest));
        let counter = ensemble.instantiate(
            counter.id,
            &InstantiateMsg {
                admin: None,
                counter: counter::interface::InstantiateMsg {
                    initial_value: 10
                }
            },
            MockEnv::new(admin, "counter")
        )
        .unwrap()
        .instance;

        let stored_admin: Option<Addr> = ensemble.query(
            &counter.address,
            &QueryMsg::Admin(admin::QueryMsg::Admin { })
        ).unwrap();

        assert_eq!(stored_admin.unwrap().as_str(), admin);

        let error = ensemble.execute(
            &ExecuteMsg::Counter(counter::interface::ExecuteMsg::Mul { value: 2 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap_err();

        assert_eq!(error.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        let error = ensemble.execute(
            &ExecuteMsg::Counter(counter::interface::ExecuteMsg::Div { value: 2 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap_err();

        assert_eq!(error.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        ensemble.execute(
            &ExecuteMsg::Counter(counter::interface::ExecuteMsg::Add { value: 1 }),
            MockEnv::new("rando", counter.address.clone())
        ).unwrap();

        let value: u64 = ensemble.query(
            &counter.address,
            &QueryMsg::Counter(counter::interface::QueryMsg::Value { })
        ).unwrap();

        assert_eq!(value, 11);

        ensemble.execute(
            &ExecuteMsg::Counter(counter::interface::ExecuteMsg::Mul { value: 2 }),
            MockEnv::new(admin, counter.address.clone())
        ).unwrap();

        let value: u64 = ensemble.query(
            &counter.address,
            &QueryMsg::Counter(counter::interface::QueryMsg::Value { })
        ).unwrap();
        
        assert_eq!(value, 22);
    }
}

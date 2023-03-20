use fadroma::dsl::*;

#[contract]
pub mod contract {
    use fadroma::{
        admin::{self, Admin, Mode},
        killswitch::{self, Killswitch, ContractStatus, ContractStatusLevel},
        scrt::vk::auth::{self, VkAuth},
        prelude::*
    };
    use super::*;

    fadroma::namespace!(pub StateNs, b"state");
    pub const STATE: ItemSpace<u64, StateNs, TypedKey<CanonicalAddr>> = ItemSpace::new();
    
    impl Contract {
        #[init(entry)]
        pub fn new(admin: Option<String>) -> Result<Response, StdError> {
            admin::init(deps, admin.as_deref(), &info)?;
    
            Ok(Response::default())
        }
    
        // This runs before executing any messages.
        #[execute_guard]
        pub fn guard(msg: &ExecuteMsg) -> Result<(), StdError> {
            let operational = killswitch::assert_is_operational(deps.as_ref());
    
            // Only allow the killswitch module messages so that we can resume the
            // the contract if it was paused for example.
            // However, if the contract has been set to the "migrating" status,
            // Even the admin cannot reverse that anymore.
            if operational.is_err() && !matches!(msg, ExecuteMsg::SetStatus { .. }) {
                Err(operational.unwrap_err())
            } else {
                Ok(())
            }
        }
    
        #[execute]
        #[admin::require_admin]
        pub fn reset_number(address: String) -> Result<Response, StdError> {
            let key = address.as_str().canonize(deps.api)?;
            STATE.save(deps.storage, &key, &0)?;
    
            Ok(Response::default())
        }
    
        #[execute]
        pub fn set_number(value: u64) -> Result<Response, StdError> {
            let key = info.sender.canonize(deps.api)?;
            STATE.save(deps.storage, &key, &value)?;
    
            Ok(Response::default())
        }
    
        #[query]
        pub fn value(address: String, vk: String) -> Result<u64, StdError> {
            let address = address.as_str().canonize(deps.api)?;
            auth::authenticate(deps.storage, &ViewingKey::from(vk), &address)?;
    
            STATE.load_or_default(deps.storage, &address)
        }
    }

    #[auto_impl(killswitch::DefaultImpl)]
    impl Killswitch for Contract {
        #[execute]
        fn set_status(
            level: ContractStatusLevel,
            reason: String,
            new_address: Option<Addr>
        ) -> Result<Response, <Self as Killswitch>::Error> { }
    
        #[query]
        fn status() -> Result<ContractStatus<Addr>, <Self as Killswitch>::Error> { }
    }

    #[auto_impl(admin::DefaultImpl)]
    impl Admin for Contract {
        #[execute]
        fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error> { }
    
        #[query]
        fn admin() -> Result<Option<Addr>, Self::Error> { }
    }

    #[auto_impl(auth::DefaultImpl)]
    impl auth::VkAuth for Contract {
        #[execute]
        fn create_viewing_key(entropy: String, padding: Option<String>) -> Result<Response, Self::Error> { }
    
        #[execute]
        fn set_viewing_key(key: String, padding: Option<String>) -> Result<Response, Self::Error> { }
    }
}

#[cfg(test)]
mod tests {
    use fadroma::{
        admin::Mode,
        cosmwasm_std::Addr,
        prelude::ContractLink,
        killswitch,
        ensemble::{ContractEnsemble, MockEnv, EnsembleResult, ExecuteResponse}
    };
    use super::contract::{self, InstantiateMsg, ExecuteMsg, QueryMsg};

    const ADMIN: &str = "admin";
    fadroma::impl_contract_harness!(SecretNumberTest, contract);

    struct TestSuite {
        ensemble: ContractEnsemble,
        contract: ContractLink<Addr>
    }

    #[test]
    fn killswitch() {
        let mut suite = TestSuite::new();

        suite.execute("user", &ExecuteMsg::SetNumber { value: 10 }).unwrap();

        // Only admin can set contract status
        let err = suite.execute(
            "rando",
            &ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Paused,
                reason: "".into(),
                new_address: None
            }
        ).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        suite.execute(
            ADMIN,
            &ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Paused,
                reason: "Test".into(),
                new_address: None
            }
        ).unwrap();

        // The contract is now paused so no messages can be executed
        let err = suite.execute(
            "user",
            &ExecuteMsg::SetNumber { value: 10 }
        ).unwrap_err();

        assert_eq!(
            err.unwrap_contract_error().to_string(),
            "Generic error: This contract has been paused. Reason: Test"
        );

        // Contract can be unpaused by the admin
        suite.execute(
            ADMIN,
            &ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Operational,
                reason: "".into(),
                new_address: None
            }
        ).unwrap();

        suite.execute(
            ADMIN,
            &ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Migrating,
                reason: "End of the line".into(),
                new_address: Some(Addr::unchecked("a new instance"))
            }
        ).unwrap();

        // Contract cannot be resumed anymore because its status
        // has now been set to "migrating".
        let err = suite.execute(
            ADMIN,
            &ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Operational,
                reason: "".into(),
                new_address: None
            }
        ).unwrap_err();

        assert_eq!(
            err.unwrap_contract_error().to_string(),
            "Generic error: This contract is being migrated to a new instance, please use that address instead. Reason: End of the line"
        );
    }

    #[test]
    fn viewing_key() {
        let mut suite = TestSuite::new();
        let user = "user";

        suite.execute(
            user,
            &ExecuteMsg::SetNumber { value: 10 }
        ).unwrap();

        let err = suite.query::<u64>(&QueryMsg::Value {
            address: user.into(),
            vk: "invalid".into()
        }).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        let key = "valid_key";

        suite.execute(
            user,
            &ExecuteMsg::SetViewingKey {
                key: key.into(),
                padding: None
            }
        ).unwrap();

        let value = suite.query::<u64>(&QueryMsg::Value {
            address: user.into(),
            vk: key.into()
        }).unwrap();

        assert_eq!(value, 10);
    }

    #[test]
    fn reset_number() {
        let mut suite = TestSuite::new();

        let user = "user";
        let key = "valid_key";

        suite.execute(
            user,
            &ExecuteMsg::SetNumber { value: 10 }
        ).unwrap();

        suite.execute(
            user,
            &ExecuteMsg::SetViewingKey {
                key: key.into(),
                padding: None
            }
        ).unwrap();

        let value = suite.query::<u64>(&QueryMsg::Value {
            address: user.into(),
            vk: key.into()
        }).unwrap();

        assert_eq!(value, 10);

        let err = suite.execute(
            "rando",
            &ExecuteMsg::ResetNumber { address: user.into() }
        ).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        suite.execute(
            ADMIN,
            &ExecuteMsg::ResetNumber { address: user.into() }
        ).unwrap();

        let value = suite.query::<u64>(&QueryMsg::Value {
            address: user.into(),
            vk: key.into()
        }).unwrap();

        assert_eq!(value, 0);
    }

    #[test]
    fn change_admin() {
        let mut suite = TestSuite::new();

        let new_admin = "new_admin";

        let admin = suite.query::<String>(
            &QueryMsg::Admin { }
        ).unwrap();

        assert_eq!(admin, ADMIN);

        let err = suite.execute(
            "rando",
            &ExecuteMsg::ChangeAdmin {
                mode: Some(Mode::Immediate { new_admin: new_admin.into() })
            }
        ).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        suite.execute(
            ADMIN,
            &ExecuteMsg::ChangeAdmin {
                mode: Some(Mode::Immediate { new_admin: new_admin.into() })
            }
        ).unwrap();

        let admin = suite.query::<String>(
            &QueryMsg::Admin { }
        ).unwrap();

        assert_eq!(admin, new_admin);
    }

    impl TestSuite {
        fn new() -> Self {
            let mut ensemble = ContractEnsemble::new();

            let contract = ensemble.register(Box::new(SecretNumberTest));
            let contract = ensemble.instantiate(
                contract.id,
                &InstantiateMsg { admin: None },
                MockEnv::new(ADMIN, "secret_number")
            )
            .unwrap()
            .instance;

            Self { ensemble, contract }
        }

        fn execute(
            &mut self,
            sender: impl Into<String>,
            msg: &ExecuteMsg
        ) -> EnsembleResult<ExecuteResponse> {
            self.ensemble.execute(
                msg,
                MockEnv::new(sender, self.contract.address.clone())
            )
        }

        fn query<T: serde::de::DeserializeOwned>(
            &self,
            msg: &QueryMsg
        ) -> EnsembleResult<T> {
            self.ensemble.query(&self.contract.address, msg)
        }
    }
}

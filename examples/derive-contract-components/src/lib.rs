use fadroma::{
    prelude::*,
    derive_contract::*,
    admin,
    // This will cause the generated message to be
    // named "SimpleAdmin" instead of just "Simple"
    admin::simple as simple_admin,
    killswitch,
    scrt::vk::{ViewingKey, auth},
};

fadroma::namespace!(pub StateNs, b"state");
pub const STATE: ItemSpace<u64, StateNs, TypedKey<CanonicalAddr>> = ItemSpace::new();

#[contract(
    entry,
    component(path = "fadroma::killswitch"),
    component(path = "simple_admin"),
    // The viewing key module has no queries so we don't generate
    // query message variants for that.
    component(path = "fadroma::scrt::vk::auth", skip(query))
)]
pub trait SecretNumber {
    #[init]
    fn new(admin: Option<String>) -> StdResult<Response> {
        admin::init(deps, admin.as_deref(), &info)?;

        Ok(Response::default())
    }

    // This runs before executing any messages.
    #[execute_guard]
    fn guard(msg: &ExecuteMsg) -> StdResult<()> {
        let operational = killswitch::assert_is_operational(deps.as_ref());

        // Only allow the killswitch module messages so that we can resume the
        // the contract if it was paused for example.
        // However, if the contract has been set to the "migrating" status,
        // Even the admin cannot reverse that anymore.
        if operational.is_err() && !matches!(msg, ExecuteMsg::Killswitch(_)) {
            Err(operational.unwrap_err())
        } else {
            Ok(())
        }
    }

    #[execute]
    #[admin::require_admin]
    fn reset_number(address: String) -> StdResult<Response> {
        let key = address.as_str().canonize(deps.api)?;
        STATE.save(deps.storage, &key, &0)?;

        Ok(Response::default())
    }

    #[execute]
    fn set_number(value: u64) -> StdResult<Response> {
        let key = info.sender.canonize(deps.api)?;
        STATE.save(deps.storage, &key, &value)?;

        Ok(Response::default())
    }

    #[query]
    fn value(address: String, vk: String) -> StdResult<u64> {
        let address = address.as_str().canonize(deps.api)?;
        auth::authenticate(deps.storage, &ViewingKey::from(vk), &address)?;

        STATE.load_or_default(deps.storage, &address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma::{
        prelude::ContractLink,
        killswitch,
        ensemble::{ContractEnsemble, MockEnv, EnsembleResult, ExecuteResponse}
    };

    const ADMIN: &str = "admin";

    fadroma::impl_contract_harness!(SecretNumberTest, super, DefaultImpl);

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
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Paused,
                reason: "".into(),
                new_address: None
            })
        ).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        suite.execute(
            ADMIN,
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Paused,
                reason: "Test".into(),
                new_address: None
            })
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
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Operational,
                reason: "".into(),
                new_address: None
            })
        ).unwrap();

        suite.execute(
            ADMIN,
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Migrating,
                reason: "End of the line".into(),
                new_address: Some(Addr::unchecked("a new instance"))
            })
        ).unwrap();

        // Contract cannot be resumed anymore because its status
        // has now been set to "migrating".
        let err = suite.execute(
            ADMIN,
            &ExecuteMsg::Killswitch(killswitch::ExecuteMsg::SetStatus {
                level: killswitch::ContractStatusLevel::Operational,
                reason: "".into(),
                new_address: None
            })
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
            &ExecuteMsg::Auth(auth::ExecuteMsg::SetViewingKey {
                key: key.into(),
                padding: None
            })
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
            &ExecuteMsg::Auth(auth::ExecuteMsg::SetViewingKey {
                key: key.into(),
                padding: None
            })
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
            &QueryMsg::SimpleAdmin(simple_admin::QueryMsg::Admin { })
        ).unwrap();

        assert_eq!(admin, ADMIN);

        let err = suite.execute(
            "rando",
            &ExecuteMsg::SimpleAdmin(simple_admin::ExecuteMsg::ChangeAdmin {
                address: new_admin.into()
            })
        ).unwrap_err();

        assert_eq!(err.unwrap_contract_error().to_string(), "Generic error: Unauthorized");

        suite.execute(
            ADMIN,
            &ExecuteMsg::SimpleAdmin(simple_admin::ExecuteMsg::ChangeAdmin {
                address: new_admin.into()
            })
        ).unwrap();

        let admin = suite.query::<String>(
            &QueryMsg::SimpleAdmin(simple_admin::QueryMsg::Admin { })
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

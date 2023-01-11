use crate::{
    cosmwasm_std::{Storage, StdResult, StdError},
    serde::{Serialize, Deserialize},
    schemars::{self, JsonSchema}
};
use super::{Permission, PermitParams};

/// The type the represents a signed permit. You shouldn't try to instantiate
/// this type yourself unless you are writing test code. Rather you set this
/// as a parameter in your contract query functions that you wish to authenticate.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct Permit<P: Permission> {
    pub params: PermitParams<P>,
    pub address: String
}

impl<P: Permission> Permit<P> {
    /// Creates a new instance using the given `params` and `signer` which
    /// is the address that "signed" the permit. This method is only useful
    /// in test code to create mock a permit.
    #[inline]
    pub fn new(
        signer: impl Into<String>,
        params: PermitParams<P>
    ) -> Self {
        Self {
            address: signer.into(),
            params
        }
    }

    pub(super) fn validate_impl(
        &self,
        storage: &dyn Storage,
        current_contract_addr: &str,
        _hrp: Option<&str>,
    ) -> StdResult<String> {
        if !self.check_contract(current_contract_addr) {
            return Err(StdError::generic_err(
                self.check_contract_err(current_contract_addr)
            ));
        }

        Self::assert_not_revoked(
            storage,
            &self.address,
            &self.params.permit_name
        )?;

        Ok(self.address.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        permit::print_permissions,
        cosmwasm_std::testing::mock_dependencies
    };

    #[test]
    fn test_permission() {
        #[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, JsonSchema)]
        #[serde(rename_all = "snake_case")]
        enum Permission {
            One,
            Two,
        }

        let ref mut deps = mock_dependencies();

        let contract_addr = "contract";
        let permissions = vec![Permission::One];
        let sender = "sender";

        let params = PermitParams::new(contract_addr)
            .permissions(permissions.clone());

        let permit = Permit::new(
            sender,
            params
        );

        let wrong_contract = "wrong_contract";
        let err = permit
            .validate(
                &deps.storage,
                wrong_contract,
                None,
                &permissions,
            )
            .unwrap_err();

        match err {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(
                    msg,
                    format!(
                        "Permit doesn't apply to contract {}, allowed contracts: {}",
                        wrong_contract,
                        contract_addr
                    )
                )
            }
            _ => panic!("Expected StdError::GenericErr"),
        }

        let expected_permissions = vec![Permission::One, Permission::Two];
        let err = permit
            .validate(
                &deps.storage,
                contract_addr.clone().into(),
                None,
                &expected_permissions,
            )
            .unwrap_err();

        match err {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(
                    msg,
                    format!(
                        "Expected permission(s): {}, got: {}",
                        print_permissions(&expected_permissions).unwrap(),
                        print_permissions(&permissions).unwrap()
                    )
                )
            }
            _ => panic!("Expected StdError::GenericErr"),
        }

        let result = permit
            .validate(
                &deps.storage,
                contract_addr.into(),
                None,
                &permissions,
            )
            .unwrap();

        assert_eq!(result, sender);
    }
}

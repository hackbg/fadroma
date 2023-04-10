//! Authentication using SNIP-24 query permits.
//! *Feature flag: `permit`*

use crate::prelude::*;
use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
mod permit;
#[cfg(not(target_arch = "wasm32"))]
mod testing;

#[cfg(target_arch = "wasm32")]
pub use permit::*;
#[cfg(not(target_arch = "wasm32"))]
pub use testing::*;

/// Marker trait that enables strongly typed permits with a finite permission set.
/// Any type that implements `Serialize + JsonSchema + Clone + PartialEq` already
/// implements this trait due to its blanket implementation.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::{
///     scrt::permit::{Permit, PermitParams},
///     serde::{Serialize, Deserialize},
///     schemars::{self, JsonSchema}
/// };
/// 
/// #[derive(Serialize, JsonSchema, Clone, PartialEq)]
/// enum MyPermissions {
///     A,
///     B
/// }
/// 
/// let params = PermitParams::new("allowed_contract").permissions([MyPermissions::A]);
/// // This constructor is available in test code only, not with cfg(target_arch = "wasm32")!
/// let permit = Permit::new("from", params);
/// 
/// assert!(permit.has_permission(&MyPermissions::A));
/// assert!(!permit.has_permission(&MyPermissions::B));
/// ```
pub trait Permission: Serialize + JsonSchema + Clone + PartialEq {}

/// Data needed to validate a [`Permit`]. You shouldn't try to instantiate
/// this type yourself unless you are writing test code.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct PermitParams<P: Permission> {
    pub allowed_tokens: Vec<String>,
    pub permit_name: String,
    pub chain_id: String,
    pub permissions: Vec<P>
}

impl<T: Serialize + JsonSchema + Clone + PartialEq> Permission for T {}

impl<P: Permission> Permit<P> {
    const NS_PERMITS: &'static [u8] = b"GAl8kO8Z8w";

    /// Validates the permit by checking whether it contains
    /// the expected permissions, the `current_contract_addr` is
    /// allowed, the permit hasn't been revoked (based on its name)
    /// and veryfing the cryptographic signature. If any of these
    /// prerequisites fails, an error is returned. Otherwise, returns
    /// the address that signed the permit.
    /// 
    /// # Parameters:
    ///  - `deps`: Needed to check whether the permit has been revoked and verify signature.
    ///  - `current_contract_addr`: The contract address that is calling this function i.e `env.contract.address`.
    ///  - `hrp`: The address prefix i.e the "secret" part of the address "secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek". Should be left as `None` most of the time.
    ///  - `expected_permissions`: The permission set that the permit needs to contains in order to successfully pass verification. Pass an empty slice (`&[]`) if you don't need to check permissions.
    pub fn validate(
        &self,
        deps: Deps,
        current_contract_addr: &str,
        hrp: Option<&str>,
        expected_permissions: &[P]
    ) -> StdResult<String> {
        if !expected_permissions
            .iter()
            .all(|x| self.has_permission(x))
        {
            return Err(StdError::generic_err(format!(
                "Expected permission(s): {}, got: {}",
                print_permissions(expected_permissions)?,
                print_permissions(&self.params.permissions)?
            )));
        }

        self.validate_impl(deps, current_contract_addr, hrp)
    }

    /// Checks if the permit has been revoked based on the `permit_name` parameter.
    /// This is already being called by [`Permit::validate`].
    pub fn assert_not_revoked(
        storage: &dyn Storage,
        account: &str,
        permit_name: &str,
    ) -> StdResult<()> {
        let key = [Self::NS_PERMITS, account.as_bytes(), permit_name.as_bytes()].concat();

        if storage.get(&key).is_some() {
            return Err(StdError::generic_err(format!(
                "Permit {:?} was revoked by account {:?}",
                permit_name,
                account
            )));
        }

        Ok(())
    }

    /// Mark any permit with `permit_name` that is signed by `account` as revoked.
    /// Any such permit will fail verification.
    pub fn revoke(storage: &mut dyn Storage, account: &Addr, permit_name: &str) {
        let key = [Self::NS_PERMITS, account.as_bytes(), permit_name.as_bytes()].concat();

        storage.set(&key, b"1")
    }

    /// Check if the permit contains the given permission.
    /// This is already being called by [`Permit::validate`].
    #[inline]
    pub fn has_permission(&self, permission: &P) -> bool {
        self.params.permissions.contains(permission)
    }

    /// Check if the given contract address is allowed to use this permit.
    /// This is already being called by [`Permit::validate`].
    #[inline]
    pub fn is_for_contract(&self, contract: &str) -> bool {
        self.params
            .allowed_tokens
            .iter()
            .map(|t| t.as_str())
            .find(|t| *t == contract)
            .is_some()
    }

    #[inline]
    fn wrong_contract_err(&self, current_contract_addr: &str) -> String {
        format!(
            "Permit doesn't apply to contract {}, allowed contracts: {}",
            current_contract_addr,
            self.params
                .allowed_tokens
                .iter()
                .map(|a| a.as_str())
                .collect::<Vec<&str>>()
                .join(", ")
        )
    }
}

impl<P: Permission> PermitParams<P> {
    #[inline]
    pub fn new(contract: impl Into<String>) -> Self {
        Self {
            permissions: vec![],
            permit_name: String::new(),
            allowed_tokens: vec![contract.into()],
            chain_id: "fadroma-ensemble-testnet".into(),
        }
    }

    #[inline]
    pub fn permissions(mut self, permissions: impl IntoIterator<Item = P>) -> Self {
        self.permissions = permissions.into_iter().collect();

        self
    }

    #[inline]
    pub fn add_allowed_contract(mut self, contract: impl Into<String>) -> Self {
        self.allowed_tokens.push(contract.into());

        self
    }

    #[inline]
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.permit_name = name.into();

        self
    }

    #[inline]
    pub fn chain_id(mut self, chain_id: impl Into<String>) -> Self {
        self.chain_id = chain_id.into();

        self
    }
}

fn print_permissions<P: Permission>(permissions: &[P]) -> StdResult<String> {
    let mut result = Vec::with_capacity(permissions.len());

    for permission in permissions {
        let bin = to_binary(&permission)?;
        let string = String::from_utf8(bin.0);

        match string {
            Ok(string) => result.push(string),
            Err(err) => return Err(StdError::generic_err(err.to_string())),
        }
    }

    Ok(result.join(", "))
}

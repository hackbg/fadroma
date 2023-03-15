//! Emergency pause and termination of contracts. You **MUST** implement
//! [admin] in your contract if you want to use this module. This is
//! enforced when using Fadroma DSL.

use std::fmt;

use crate::{
    self as fadroma,
    admin::{self, Admin, Mode},
    cosmwasm_std,
    dsl::*,
    impl_canonize_default,
    prelude::*,
};

use serde::{Deserialize, Serialize};

crate::namespace!(pub KillswitchNs, b"zK5CBApPlV");
pub const STORE: SingleItem<ContractStatus<CanonicalAddr>, KillswitchNs> = SingleItem::new();

// TODO once serde-json-wasm finally supports serializing Rusty enums,
// this structure can be merged with `ContractStatusLevel`, with
// `reason` and `new_address` becoming propeties of `Migrating`

/// Current state of a contract w/ optional description and pointer to new version.
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Canonize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus<A> {
    pub level: ContractStatusLevel,
    pub reason: String,
    pub new_address: Option<A>
}

/// Possible states of a contract.
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, JsonSchema, PartialEq, Debug, Clone, Copy)]
pub enum ContractStatusLevel {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused,
    /// Permanently disabled
    Migrating
}

/// Requires the admin component in order to check for admin.
#[interface]
pub trait Killswitch: Admin {
    type Error: std::fmt::Display;

    #[execute]
    fn set_status(
        level: ContractStatusLevel,
        reason: String,
        new_address: Option<Addr>
    ) -> Result<Response, <Self as Killswitch>::Error>;

    #[query]
    fn status() -> Result<ContractStatus<Addr>, <Self as Killswitch>::Error>;
}

pub struct DefaultImpl;

impl Admin for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error> {
        admin::DefaultImpl::change_admin(deps, env, info, mode)
    }

    #[query]
    fn admin() -> Result<Option<Addr>, Self::Error> {
        admin::DefaultImpl::admin(deps, env)
    }
}

impl Killswitch for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn set_status(
        level: ContractStatusLevel,
        reason: String,
        new_address: Option<Addr>
    ) -> StdResult<Response> {
        set_status(deps, info, level, reason, new_address)?;

        Ok(Response::new()
            .add_attribute("action", "set_status")
            .add_attribute("level", format!("{}", level))
        )
    }

    #[query]
    fn status() -> StdResult<ContractStatus<Addr>> {
        STORE.load_humanize_or_default(deps)
    }
}

impl_canonize_default!(ContractStatusLevel);

/// Returns `false` if the current contract status level is other than [`ContractStatusLevel::Operational`].
#[inline]
pub fn is_operational(deps: Deps) -> StdResult<bool> {
    match assert_is_operational(deps) {
        Ok(_) => Ok(true),
        Err(err) if matches!(err, StdError::GenericErr { .. }) => Ok(false),
        Err(err) => Err(err)
    }
}

/// Fail if the current contract status level is other than [`ContractStatusLevel::Operational`].
#[inline]
pub fn assert_is_operational(deps: Deps) -> StdResult<()> {
    let ContractStatus {
        level,
        reason,
        new_address
    } = STORE.load_or_default(deps.storage)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Err(paused_err(&reason)),
        ContractStatusLevel::Migrating => {
            let address = new_address.humanize(deps.api)?;

            Err(migrating_err(&reason, address.as_ref()))
        },
    }
}

/// Fail if trying to return from [`ContractStatusLevel::Migrating`] status.
#[inline]
pub fn assert_can_set_status(deps: Deps, to_level: ContractStatusLevel) -> StdResult<()> {
    let ContractStatus {
        level,
        reason,
        new_address
    } = STORE.load_or_default(deps.storage)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Ok(()),
        ContractStatusLevel::Migrating => match to_level {
            // if already migrating, allow message and new_address to be updated
            ContractStatusLevel::Migrating => Ok(()),
            // but prevent reverting from migration status
            _ => {
                let address = new_address.humanize(deps.api)?;

                Err(migrating_err(&reason, address.as_ref()))
            }
        },
    }
}

/// Store a new contract status. Requires the admin component in order to check for admin.
#[inline]
#[admin::require_admin]
pub fn set_status(
    deps: DepsMut,
    info: MessageInfo,
    level: ContractStatusLevel,
    reason: String,
    new_address: Option<Addr>
) -> StdResult<()> {
    assert_can_set_status(deps.as_ref(), level)?;
    let status = ContractStatus { level, reason, new_address };

    STORE.canonize_and_save(deps, status)
}

#[inline]
fn paused_err(reason: &str) -> StdError {
    let msg = format!("This contract has been paused. Reason: {}", reason);

    StdError::generic_err(msg)
}

#[inline]
fn migrating_err(reason: &str, new_address: Option<&Addr>) -> StdError {
    let msg = format!(
        "This contract is being migrated to {}, please use that address instead. Reason: {}",
        new_address.as_deref().unwrap_or(&Addr::unchecked("")),
        reason
    );

    StdError::generic_err(msg)
}

impl<A> Default for ContractStatus<A> {
    fn default() -> Self {
        Self {
            level: ContractStatusLevel::Operational,
            reason: String::new(),
            new_address: None
        }
    }
}

impl fmt::Display for ContractStatusLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Self::Operational => write!(f, "operational"),
            Self::Paused => write!(f, "paused"),
            Self::Migrating => write!(f, "migrating")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cosmwasm_std::testing::{mock_dependencies, mock_info};

    #[test]
    fn test_migrate() {
        let mut deps = mock_dependencies();
        let admin = "admin";

        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(current.level, ContractStatusLevel::Operational);

        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap();

        let reason = String::from("Reason");
        let new_address = Addr::unchecked("new_address");

        let err = set_status(
            deps.as_mut(),
            mock_info("not_admin", &[]),
            ContractStatusLevel::Paused,
            "Test reason".into(),
            None,
        )
        .unwrap_err();

        assert_eq!(err, StdError::generic_err("Unauthorized"));

        set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            ContractStatusLevel::Paused,
            reason.clone(),
            None,
        )
        .unwrap();

        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap_err();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(
            current,
            ContractStatus {
                level: ContractStatusLevel::Paused,
                reason: reason.clone(),
                new_address: None
            }
        );

        set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            ContractStatusLevel::Migrating,
            reason.clone(),
            None,
        )
        .unwrap();

        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap_err();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap_err();
        assert_can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap_err();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(
            current,
            ContractStatus {
                level: ContractStatusLevel::Migrating,
                reason: reason.clone(),
                new_address: None
            }
        );

        set_status(
            deps.as_mut(),
            mock_info("admin", &[]),
            ContractStatusLevel::Migrating,
            reason.clone(),
            Some(new_address.clone()),
        )
        .unwrap();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(
            current,
            ContractStatus {
                level: ContractStatusLevel::Migrating,
                reason,
                new_address: Some(new_address)
            }
        );
    }
}

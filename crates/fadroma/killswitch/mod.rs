//! Emergency pause and termination of contracts. You **MUST** implement
//! [admin] in your contract if you want to use this module.

use std::fmt;

use crate::{
    self as fadroma,
    admin,
    storage,
    cosmwasm_std,
    derive_contract::*,
    impl_canonize_default,
    prelude::*,
};

use serde::{Deserialize, Serialize};

const PREFIX: &[u8] = b"zK5CBApPlV";

/// Requires the admin component in order to check for admin.
#[contract]
pub trait Killswitch {
    #[execute]
    fn set_status(
        level: ContractStatusLevel,
        reason: String,
        new_address: Option<Addr>,
    ) -> StdResult<Response> {
        set_status(deps, info, level, reason, new_address)?;

        Ok(Response::new()
            .add_attribute("action", "set_status")
            .add_attribute("level", format!("{}", level))
        )
    }

    #[query]
    fn status() -> StdResult<ContractStatus<Addr>> {
        load(deps)
    }
}

macro_rules! migration_message {
    (paused: $reason:expr) => {
        format!("This contract has been paused. Reason: {}", &$reason)
    };
    (migration: $reason:expr, $new_address:expr) => {
        format!(
            "This contract is being migrated to {}, please use that address instead. Reason: {}",
            &$new_address.unwrap_or(Addr::unchecked("")),
            &$reason
        )
    };
}

/// Return the current contract status. Defaults to [`ContractStatusLevel::Operational`] if nothing was stored.
#[inline]
pub fn load(deps: Deps) -> StdResult<ContractStatus<Addr>> {
    let result: Option<ContractStatus<CanonicalAddr>> = storage::load(
        deps.storage,
        PREFIX
    )?;

    result.unwrap_or_default().humanize(deps.api)
}

/// Save the `status` to storage.
#[inline]
pub fn save(deps: DepsMut, status: ContractStatus<Addr>) -> StdResult<()> {
    let status = status.canonize(deps.api)?;

    storage::save(deps.storage, PREFIX, &status)
}

/// Possible states of a contract.
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone, Copy)]
pub enum ContractStatusLevel {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused,
    /// Permanently disabled
    Migrating
}

impl_canonize_default!(ContractStatusLevel);

impl fmt::Display for ContractStatusLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Self::Operational => write!(f, "operational"),
            Self::Paused => write!(f, "paused"),
            Self::Migrating => write!(f, "migrating")
        }
    }
}

// TODO once serde-json-wasm finally supports serializing Rusty enums,
// this structure can be merged with `ContractStatusLevel`, with
// `reason` and `new_address` becoming propeties of `Migrating`
/// Current state of a contract w/ optional description and pointer to new version.
#[derive(Serialize, Deserialize, Canonize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus<A> {
    pub level: ContractStatusLevel,
    pub reason: String,
    pub new_address: Option<A>
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
    } = load(deps)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Err(StdError::GenericErr {
            msg: migration_message!(paused: reason),
        }),
        ContractStatusLevel::Migrating => Err(StdError::GenericErr {
            msg: migration_message!(migration: reason, new_address.clone()),
        }),
    }
}

/// Fail if trying to return from [`ContractStatusLevel::Migrating`] status.
#[inline]
pub fn assert_can_set_status(deps: Deps, to_level: ContractStatusLevel) -> StdResult<()> {
    let ContractStatus {
        level,
        reason,
        new_address
    } = load(deps)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Ok(()),
        ContractStatusLevel::Migrating => match to_level {
            // if already migrating, allow message and new_address to be updated
            ContractStatusLevel::Migrating => Ok(()),
            // but prevent reverting from migration status
            _ => Err(StdError::GenericErr {
                msg: migration_message!(migration: reason, new_address.clone()),
            }),
        },
    }
}

/// Store a new contract status. Requires the admin component in order to check for admin.
#[admin::require_admin]
#[inline]
pub fn set_status(
    deps: DepsMut,
    info: MessageInfo,
    level: ContractStatusLevel,
    reason: String,
    new_address: Option<Addr>
) -> StdResult<()> {
    assert_can_set_status(deps.as_ref(), level)?;

    save(deps, ContractStatus { level, reason, new_address })
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

        let current = load(deps.as_ref()).unwrap();
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

        let current = load(deps.as_ref()).unwrap();
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

        let current = load(deps.as_ref()).unwrap();
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

        let current = load(deps.as_ref()).unwrap();
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

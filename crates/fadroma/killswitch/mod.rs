//! Emergency pause and termination of contracts.

use std::fmt;

use crate::{
    self as fadroma,
    admin::{assert_admin, require_admin},
    cosmwasm_std,
    derive_contract::*,
    impl_canonize_default,
    prelude::*,
};

use serde::{Deserialize, Serialize};

pub const PREFIX: &[u8] = b"fadroma_migration_state";

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
    fn get_status() -> StdResult<ContractStatus<Addr>> {
        let status = load(deps.storage)?;

        status.humanize(deps.api)
    }
}

// TODO: should we remove this?
/// Wrap status levels around the `match` statement that does your handle dispatch.
#[macro_export]
macro_rules! with_status {
    // by default, assumes the execute msg enum is called `ExecuteMsg` and imported
    ($deps:ident, $env:ident, $info:ident, match $msg:ident { $($rest:tt)* }) => {
        with_status!(ExecuteMsg, $deps, $env, $info, match $msg { $($rest)* })
    };
    // but an alternative name can be passed
    ($ExecuteMsg:ty, $deps:ident, $env:ident, $info:ident, match $msg:ident { $($rest:tt)* }) => {
        if let ExecuteMsg::SetStatus { level, reason, new_address } = $msg {
            fadroma::killswitch::set_status($deps, $env, $info, level, reason, new_address)?;
            Ok(Response::default())
        } else {
            fadroma::killswitch::is_operational($deps)?;
            match $msg {
                ExecuteMsg::SetStatus { .. } => unreachable!(),
                $($rest)*
            }
        }
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

pub fn load(storage: &dyn Storage) -> StdResult<ContractStatus<CanonicalAddr>> {
    let result: Option<ContractStatus<CanonicalAddr>> = crate::storage::load(storage, PREFIX)?;

    match result {
        Some(status) => Ok(status),
        None => Ok(ContractStatus::default()),
    }
}

pub fn save(storage: &mut dyn Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
    crate::storage::save(storage, PREFIX, status)
}

/// Possible states of a contract.
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone, Copy)]
pub enum ContractStatusLevel {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused,
    /// Permanently disabled
    Migrating,
}

impl_canonize_default!(ContractStatusLevel);

impl fmt::Display for ContractStatusLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Self::Operational => write!(f, "operational"),
            Self::Paused => write!(f, "paused"),
            Self::Migrating => write!(f, "migrating"),
        }
    }
}

// TODO once serde-json-wasm finally supports serializing Rusty enums,
// this structure can be merged with `ContractStatusLevel`, with
// `reason` and `new_address` becoming propeties of `Migrating`
/// Current state of a contract w/ optional description and pointer to new version
#[derive(Serialize, Deserialize, Canonize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus<A> {
    pub level: ContractStatusLevel,
    pub reason: String,
    pub new_address: Option<A>,
}

impl<A> Default for ContractStatus<A> {
    fn default() -> Self {
        Self {
            level: ContractStatusLevel::Operational,
            reason: String::new(),
            new_address: None,
        }
    }
}

/// Return the current contract status. Defaults to operational if nothing was stored.
pub fn get_status(deps: Deps) -> StdResult<ContractStatus<Addr>> {
    load(deps.storage)?.humanize(deps.api)
}

/// Fail if the current contract status level is other than `Operational`.
pub fn is_operational(deps: Deps) -> StdResult<()> {
    let ContractStatus {
        level,
        reason,
        new_address,
    } = get_status(deps)?;

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

/// Fail if trying to return from `Migrating` status.
pub fn can_set_status(deps: Deps, to_level: ContractStatusLevel) -> StdResult<()> {
    let ContractStatus {
        level,
        reason,
        new_address,
    } = get_status(deps)?;

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
#[require_admin]
pub fn set_status(
    deps: DepsMut,
    info: MessageInfo,
    level: ContractStatusLevel,
    reason: String,
    new_address: Option<Addr>,
) -> StdResult<()> {
    can_set_status(deps.as_ref(), level)?;

    save(
        deps.storage,
        &ContractStatus {
            level,
            reason,
            new_address: match new_address {
                Some(new_address) => Some(deps.api.addr_canonicalize(new_address.as_str())?),
                None => None,
            },
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::admin::{self, simple::SimpleAdmin};
    use crate::cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_migrate() {
        let mut deps = mock_dependencies();
        let admin = "admin";

        admin::simple::DefaultImpl
            .new(
                Some(admin.into()),
                deps.as_mut(),
                mock_env(),
                mock_info(admin, &[]),
            )
            .unwrap();

        let current = get_status(deps.as_ref()).unwrap();
        assert_eq!(current.level, ContractStatusLevel::Operational);

        can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap();
        can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap();
        can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        is_operational(deps.as_ref()).unwrap();

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

        can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap();
        can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap();
        can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        is_operational(deps.as_ref()).unwrap_err();

        let current = get_status(deps.as_ref()).unwrap();
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

        can_set_status(deps.as_ref(), ContractStatusLevel::Operational).unwrap_err();
        can_set_status(deps.as_ref(), ContractStatusLevel::Paused).unwrap_err();
        can_set_status(deps.as_ref(), ContractStatusLevel::Migrating).unwrap();
        is_operational(deps.as_ref()).unwrap_err();

        let current = get_status(deps.as_ref()).unwrap();
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

        let current = get_status(deps.as_ref()).unwrap();
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

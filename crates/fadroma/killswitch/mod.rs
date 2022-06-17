//! *Feature flag: `killswitch`*
//! Emergency pause and termination of contracts.

use std::fmt;

use crate::{
    prelude::*,
    admin::{assert_admin, require_admin},
};

use serde::{Serialize, Deserialize};

pub const PREFIX: &[u8] = b"fadroma_migration_state";

/// Requires the admin component in order to check for admin.
#[contract]
pub trait Killswitch {
    #[handle]
    fn set_status(
        level: ContractStatusLevel,
        reason: String,
        new_address: Option<HumanAddr>
    ) -> StdResult<HandleResponse> {
        set_status(deps, env, level, reason, new_address)?;

        Ok(HandleResponse {
            messages: vec![],
            log: vec![
                log("action", "set_status"),
                log("level", level)
            ],
            data: None
        })
    }

    #[query]
    fn get_status() -> StdResult<ContractStatus<HumanAddr>> {
        let status = load(&deps.storage)?;

        status.humanize(&deps.api)
    }
}

/// Wrap status levels around the `match` statement that does your handle dispatch.
#[macro_export] macro_rules! with_status {
    // by default, assumes the handle msg enum is called `HandleMsg` and imported
    ($deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        with_status!(HandleMsg, $deps, $env, match $msg { $($rest)* })
    };
    // but an alternative name can be passed
    ($HandleMsg:ty, $deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        if let HandleMsg::SetStatus { level, reason, new_address } = $msg {
            fadroma::killswitch::set_status($deps, $env, level, reason, new_address)?;
            Ok(HandleResponse::default())
        } else {
            fadroma::killswitch::is_operational(&$deps)?;
            match $msg {
                HandleMsg::SetStatus { .. } => unreachable!(),
                $($rest)*
            }
        }
    }
}

macro_rules! migration_message {
    (paused: $reason:expr) => { format!(
         "This contract has been paused. Reason: {}",
         &$reason
    ) };
    (migration: $reason:expr, $new_address:expr) => { format!(
         "This contract is being migrated to {}, please use that address instead. Reason: {}",
         &$new_address.unwrap_or(HumanAddr::default()),
         &$reason
    ) };
}

pub fn load (storage: &impl Storage) -> StdResult<ContractStatus<CanonicalAddr>> {
    let result: Option<ContractStatus<CanonicalAddr>> =
        crate::storage::load(storage, PREFIX)?;

    match result {
        Some(status) => Ok(status),
        None => Ok(ContractStatus::default())
    }
}

pub fn save (storage: &mut impl Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
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
/// Current state of a contract w/ optional description and pointer to new version
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus<A> {
    pub level:       ContractStatusLevel,
    pub reason:      String,
    pub new_address: Option<A>
}

impl<A> Default for ContractStatus<A> {
    fn default () -> Self { Self {
        level:       ContractStatusLevel::Operational,
        reason:      String::new(),
        new_address: None
    } }
}

impl Humanize for ContractStatus<CanonicalAddr> {
    type Output = ContractStatus<HumanAddr>;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(ContractStatus {
            level: self.level,
            reason: self.reason,
            new_address: self.new_address.humanize(api)?
        })
    }
}

impl Canonize for ContractStatus<HumanAddr> {
    type Output = ContractStatus<CanonicalAddr>;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(ContractStatus {
            level: self.level,
            reason: self.reason,
            new_address: self.new_address.canonize(api)?
        })
    }
}

/// Return the current contract status. Defaults to operational if nothing was stored.
pub fn get_status <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<ContractStatus<HumanAddr>> {
    load(&deps.storage)?.humanize(&deps.api)
}

/// Fail if the current contract status level is other than `Operational`.
pub fn is_operational <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<()> {
    let ContractStatus { level, reason, new_address } = get_status(deps)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Err(StdError::GenericErr {
            backtrace: None,
            msg: migration_message!(paused: reason)
        }),
        ContractStatusLevel::Migrating => Err(StdError::GenericErr {
            backtrace: None,
            msg: migration_message!(migration: reason, new_address.clone())
        }),
    }
}

/// Fail if trying to return from `Migrating` status.
pub fn can_set_status <S: Storage, A: Api, Q: Querier>  (
    deps: &Extern<S, A, Q>,
    to_level: ContractStatusLevel
) -> StdResult<()> {
    let ContractStatus { level, reason, new_address } = get_status(deps)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Ok(()),
        ContractStatusLevel::Migrating => match to_level {
            // if already migrating, allow message and new_address to be updated
            ContractStatusLevel::Migrating => Ok(()),
            // but prevent reverting from migration status
            _ => Err(StdError::GenericErr {
                backtrace: None,
                msg: migration_message!(migration: reason, new_address.clone())
            })
        }
    }
}

/// Store a new contract status. Requires the admin component in order to check for admin.
#[require_admin]
pub fn set_status <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>,
    env: Env,
    level: ContractStatusLevel,
    reason: String,
    new_address: Option<HumanAddr>
) -> StdResult<()> {
    can_set_status(deps, level)?;
    
    save(&mut deps.storage, &ContractStatus { level, reason, new_address: match new_address {
        Some(new_address) => Some(new_address.canonize(&deps.api)?),
        None => None
    } })
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::scrt::cosmwasm_std::testing::{mock_dependencies, mock_env};
    use crate::auth::{admin, admin::Admin};

    #[test]
    fn test_migrate() {
        let ref mut deps = mock_dependencies(20, &[]);
        let admin = "admin";

        admin::DefaultImpl.new(Some(admin.into()), deps, mock_env(admin, &[])).unwrap();

        let current = get_status(deps).unwrap();
        assert_eq!(current.level, ContractStatusLevel::Operational);

        can_set_status(deps, ContractStatusLevel::Operational).unwrap();
        can_set_status(deps, ContractStatusLevel::Paused).unwrap();
        can_set_status(deps, ContractStatusLevel::Migrating).unwrap();
        is_operational(deps).unwrap();

        let reason = String::from("Reason");
        let new_address = HumanAddr("new_address".into());

        let err = set_status(
            deps,
            mock_env("not_admin", &[]),
            ContractStatusLevel::Paused,
            "Test reason".into(),
            None
        ).unwrap_err();

        assert_eq!(err, StdError::unauthorized());

        set_status(
            deps,
            mock_env(admin, &[]),
            ContractStatusLevel::Paused,
            reason.clone(),
            None
        ).unwrap();

        can_set_status(deps, ContractStatusLevel::Operational).unwrap();
        can_set_status(deps, ContractStatusLevel::Paused).unwrap();
        can_set_status(deps, ContractStatusLevel::Migrating).unwrap();
        is_operational(deps).unwrap_err();

        let current = get_status(deps).unwrap();
        assert_eq!(current, ContractStatus {
            level: ContractStatusLevel::Paused,
            reason: reason.clone(),
            new_address: None
        });

        set_status(
            deps,
            mock_env(admin, &[]),
            ContractStatusLevel::Migrating,
            reason.clone(),
            None
        ).unwrap();

        can_set_status(deps, ContractStatusLevel::Operational).unwrap_err();
        can_set_status(deps, ContractStatusLevel::Paused).unwrap_err();
        can_set_status(deps, ContractStatusLevel::Migrating).unwrap();
        is_operational(deps).unwrap_err();

        let current = get_status(deps).unwrap();
        assert_eq!(current, ContractStatus {
            level: ContractStatusLevel::Migrating,
            reason: reason.clone(),
            new_address: None
        });

        set_status(
            deps,
            mock_env(admin, &[]),
            ContractStatusLevel::Migrating,
            reason.clone(),
            Some(new_address.clone())
        ).unwrap();

        let current = get_status(deps).unwrap();
        assert_eq!(current, ContractStatus {
            level: ContractStatusLevel::Migrating,
            reason,
            new_address: Some(new_address)
        });
    }
}

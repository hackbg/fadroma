use crate::{scrt::*, scrt_addr::*}
use composable_admin::{require_admin, admin::assert_admin};

use crate::{scrt::*, scrt_addr::*};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use fadroma_scrt_addr::{Humanize, Canonize};

use cosmwasm_std::{StdResult, CanonicalAddr, Storage};
use crate::types::ContractStatus;

pub const PREFIX: &[u8] = b"fadroma_migration_state";

pub fn load (storage: &impl Storage) -> StdResult<ContractStatus<CanonicalAddr>> {
    match fadroma_scrt_utils::storage::load(storage, PREFIX)? {
        Some(status) => status,
        None => Ok(ContractStatus::default())
    }
}
pub fn save (storage: &mut impl Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
    fadroma_scrt_utils::storage::save(storage, PREFIX, status)
}

/// Possible states of a contract.
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum ContractStatusLevel {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused,
    /// Permanently disabled
    Migrating,
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
impl Humanize<ContractStatus<HumanAddr>> for ContractStatus<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<ContractStatus<HumanAddr>> {
        Ok(ContractStatus {
            level: self.level.clone(),
            reason: self.reason.clone(),
            new_address: match &self.new_address {
                Some(canon_addr) => Some(api.human_address(&canon_addr)?),
                None => None
            }
        })
    }
}
impl Canonize<ContractStatus<CanonicalAddr>> for ContractStatus<HumanAddr> {
    fn canonize (&self, api: &impl Api) -> StdResult<ContractStatus<CanonicalAddr>> {
        Ok(ContractStatus {
            level: self.level.clone(),
            reason: self.reason.clone(),
            new_address: match &self.new_address {
                Some(human_addr) => Some(api.canonical_address(&human_addr)?),
                None => None
            }
        })
    }
}

/// Return the current contract status. Defaults to operational if nothing was stored.
pub fn get_status <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<types::ContractStatus<HumanAddr>> {
    storage::load(&deps.storage)?.humanize(&deps.api)
}

/// Fail if the current contract status level is other than `Operational`.
pub fn is_operational <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<()> {
    checks::is_operational(&get_status(deps)?)
}

/// Fail if trying to return from `Migrating` status.
pub fn can_set_status <S: Storage, A: Api, Q: Querier>  (
    deps: &Extern<S, A, Q>,
    to_level: &types::ContractStatusLevel
) -> StdResult<()> {
    checks::can_set_status(&get_status(deps)?, to_level)
}

/// Store a new contract status.
#[require_admin]
pub fn set_status <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>,
    env: Env,
    level: types::ContractStatusLevel,
    reason: String,
    new_address: Option<HumanAddr>
) -> StdResult<()> {
    storage::save(&mut deps.storage, &types::ContractStatus { level, reason, new_address: match new_address {
        Some(new_address) => Some(new_address.canonize(&deps.api)?),
        None => None
    } })
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
            fadroma_scrt_migrate::can_set_status(&$deps, &level)?;
            fadroma_scrt_migrate::set_status($deps, $env, level, reason, new_address)?;
            Ok(HandleResponse::default())
        } else {
            fadroma_scrt_migrate::is_operational(&$deps)?;
            match $msg {
                HandleMsg::SetStatus { .. } => unreachable!(),
                $($rest)*
            }
        }
    }
}
use cosmwasm_std::{StdResult, StdError, HumanAddr};
use crate::types::{ContractStatus, ContractStatusLevel};

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

pub fn is_operational (status: &ContractStatus<HumanAddr>) -> StdResult<()> {
    let ContractStatus { level, reason, new_address } = status;
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

pub fn can_set_status (
    status:           &ContractStatus<HumanAddr>,
    new_status_level: &ContractStatusLevel
) -> StdResult<()> {
    let ContractStatus { level, reason, new_address } = status;
    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Ok(()),
        ContractStatusLevel::Migrating => match new_status_level {
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

use crate::{
    scrt::{
        StdResult, CanonicalAddr, Api, MessageInfo,
        Deps, DepsMut, Addr, StdError
    },
    scrt_addr::{Humanize, Canonize},
    scrt_storage::{load, save},
    composable_admin::admin::assert_admin,
    require_admin::require_admin
};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;

pub const PREFIX: &[u8] = b"fadroma_migration_state";

/// Wrap status levels around the `match` statement that does your handle dispatch.
#[macro_export] macro_rules! with_status {
    // by default, assumes the handle msg enum is called `HandleMsg` and imported
    ($deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        with_status!(HandleMsg, $deps, $env, match $msg { $($rest)* })
    };
    // but an alternative name can be passed
    ($HandleMsg:ty, $deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        if let HandleMsg::SetStatus { level, reason, new_address } = $msg {
            scrt_migrate::can_set_status(&$deps, &level)?;
            scrt_migrate::set_status($deps, $env, level, reason, new_address)?;
            Ok(HandleResponse::default())
        } else {
            scrt_migrate::is_operational(&$deps)?;
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
    (migration: $reason:expr, $new_address:expr) => {
        if let Some(address) = $new_address {
            format!(
                "This contract is being migrated to {}, please use that address instead. Reason: {}",
                address,
                &$reason
            ) 
        } else {
            format!(
                "This contract is being migrated. Reason: {}",
                &$reason
            ) 
        }

    };
}
/*
pub fn load (storage: &impl Storage) -> StdResult<ContractStatus<CanonicalAddr>> {
    match scrt_storage::load(storage, PREFIX)? {
        Some(status) => status,
        None => Ok(ContractStatus::default())
    }
}
pub fn save (storage: &mut impl Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
    scrt_storage::save(storage, PREFIX, status)
}
*/
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
impl Humanize<ContractStatus<Addr>> for ContractStatus<CanonicalAddr> {
    fn humanize (self, api: &dyn Api) -> StdResult<ContractStatus<Addr>> {
        Ok(ContractStatus {
            level: self.level,
            reason: self.reason,
            new_address: match self.new_address {
                Some(canon_addr) => Some(api.addr_humanize(&canon_addr)?),
                None => None
            }
        })
    }
}
impl Canonize<ContractStatus<CanonicalAddr>> for ContractStatus<Addr> {
    fn canonize (&self, api: &dyn Api) -> StdResult<ContractStatus<CanonicalAddr>> {
        Ok(ContractStatus {
            level: self.level.clone(),
            reason: self.reason.clone(),
            new_address: match &self.new_address {
                Some(human_addr) => Some(api.addr_canonicalize(human_addr.as_str())?),
                None => None
            }
        })
    }
}

/// Return the current contract status. Defaults to operational if nothing was stored.
pub fn get_status (deps: Deps) -> StdResult<ContractStatus<Addr>> {
    let result: Option<ContractStatus<CanonicalAddr>> = load(deps.storage, PREFIX)?;

    match result {
        Some(status) => status.humanize(deps.api),
        None => Ok(ContractStatus::default())
    }
}

/// Fail if the current contract status level is other than `Operational`.
pub fn is_operational(deps: Deps) -> StdResult<()> {
    let ContractStatus { level, reason, new_address } = get_status(deps)?;

    match level {
        ContractStatusLevel::Operational => Ok(()),
        ContractStatusLevel::Paused => Err(StdError::GenericErr {
            msg: migration_message!(paused: reason)
        }),
        ContractStatusLevel::Migrating => Err(StdError::GenericErr {
            msg: migration_message!(migration: reason, new_address.clone())
        }),
    }
}

/// Fail if trying to return from `Migrating` status.
pub fn can_set_status(deps: Deps, to_level: &ContractStatusLevel
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
                msg: migration_message!(migration: reason, new_address.clone())
            })
        }
    }
}

/// Store a new contract status.
#[require_admin]
pub fn set_status(
    deps: DepsMut,
    info: MessageInfo,
    level: ContractStatusLevel,
    reason: String,
    new_address: Option<Addr>
) -> StdResult<()> {
    save(deps.storage, PREFIX, &ContractStatus { level, reason, new_address: match new_address {
        Some(new_address) => Some(new_address.canonize(deps.api)?),
        None => None
    } })
}

use cosmwasm_std::{StdResult, StdError, HumanAddr};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum ContractStatusLevel {
    Operational,
    Paused,
    Migrating,
}

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus {
    pub level:       ContractStatusLevel,
    pub reason:      String,
    pub new_address: Option<HumanAddr>
}

impl Default for ContractStatus {
    fn default () -> Self {
        Self {
            level:       ContractStatusLevel::Operational,
            reason:      String::new(),
            new_address: None
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

pub fn is_operational (status: &ContractStatus) -> StdResult<()> {
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
    status:           &ContractStatus,
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

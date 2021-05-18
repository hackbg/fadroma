use cosmwasm_std::{StdResult, HumanAddr, CanonicalAddr, Storage};
use crate::{types::{ContractStatus, ContractStatusLevel}};

pub const PREFIX: &[u8] = b"fadroma_migration_state";

pub fn load (storage: &impl Storage) -> StdResult<ContractStatus<HumanAddr>> {
    match cosmwasm_utils::storage::load(storage, PREFIX)? {
        Some(status) => status,
        None => Ok(ContractStatus::default())
    }
}
pub fn save (storage: &mut impl Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
    cosmwasm_utils::storage::save(storage, PREFIX, status)
}
pub fn is_operational (storage: &impl Storage) -> StdResult<()> {
    crate::checks::is_operational(&load(storage)?)
}
pub fn can_set_status (storage: &impl Storage, level: &ContractStatusLevel) -> StdResult<()> {
    crate::checks::can_set_status(&load(storage)?, level)
}

use cosmwasm_std::{StdResult, CanonicalAddr, Storage};
use crate::types::ContractStatus;

pub const PREFIX: &[u8] = b"fadroma_migration_state";

pub fn load (storage: &impl Storage) -> StdResult<ContractStatus<CanonicalAddr>> {
    match cosmwasm_utils::storage::load(storage, PREFIX)? {
        Some(status) => status,
        None => Ok(ContractStatus::default())
    }
}
pub fn save (storage: &mut impl Storage, status: &ContractStatus<CanonicalAddr>) -> StdResult<()> {
    cosmwasm_utils::storage::save(storage, PREFIX, status)
}

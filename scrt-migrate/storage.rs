use cosmwasm_std::{StdResult, HumanAddr};
use cosmwasm_utils::storage::{load, save};

use crate::{
    types::{ContractStatus, ContractStatusLevel},
    checks::{is_operational, can_check_status}
};

pub enum MigrationState {
    pub const STORAGE_KEY: &[u8] = b"fadroma_migration_state";
    pub fn load (storage: &S) -> StdResult<ContractStatus<HumanAddr>> {
        load(storage, Self::STORAGE_KEY)?
    }
    pub fn save (storage: &S, status: ContractStatus<HumanAddr>) -> StdResult<()> {
        save(storage, Self::STORAGE_KEY, status)?
    }
    pub fn is_operational (storage: &S) -> StdResult<()> {
        is_operational(Self::load(storage)?)?
    }
    pub fn can_check_status (storage: &S, level: &ContractStatusLevel) -> StdResult<()> {
        can_check_status(Self::load(storage)?, level)?
    }
}

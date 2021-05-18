use cosmwasm_std::{CanonicalAddr, HumanAddr, Api, StdResult};

pub mod viewing_key;
pub mod storage;
pub mod crypto;
pub mod convert;
pub mod u256_math;

mod data;

pub use data::*;

/// Attempting to canonicalize an empty address will fail. 
/// This function skips calling `canonical_address` if the input is empty
/// and returns `CanonicalAddr::default()` instead.
pub fn canonicalize_maybe_empty(api: &impl Api, addr: &HumanAddr) -> StdResult<CanonicalAddr> {
    Ok(
        if *addr == HumanAddr::default() {
            CanonicalAddr::default()
        } else {
            api.canonical_address(addr)?
        }
    )
}

/// Attempting to humanize an empty address will fail. 
/// This function skips calling `human_address` if the input is empty
/// and returns `HumanAddr::default()` instead.
pub fn humanize_maybe_empty(api: &impl Api, addr: &CanonicalAddr) -> StdResult<HumanAddr> {
    Ok(
        if *addr == CanonicalAddr::default() {
            HumanAddr::default()
        } else {
            api.human_address(addr)?
        }
    )
}

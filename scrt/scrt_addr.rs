//! `HumanAddr`<->`CanonicalAddr` conversion

use cosmwasm_std::{Api, CanonicalAddr, HumanAddr, StdResult};

pub trait Humanize<T> {
    fn humanize (&self, api: &impl Api) -> StdResult<T>;
}

pub trait Canonize<T> {
    fn canonize (&self, api: &impl Api) -> StdResult<T>;
}

/// Attempting to canonicalize an empty address will fail. 
/// This function skips calling `canonical_address` if the input is empty
/// and returns `CanonicalAddr::default()` instead.
pub fn canonize_maybe_empty(api: &impl Api, addr: &HumanAddr) -> StdResult<CanonicalAddr> {
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

impl Humanize<HumanAddr> for CanonicalAddr {
    fn humanize (&self, api: &impl Api) -> StdResult<HumanAddr> {
        humanize_maybe_empty(api, self)
    }
}

impl<T: Humanize<U>, U> Humanize<Vec<U>> for Vec<T> {
    fn humanize (&self, api: &impl Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.humanize(api)).collect()
    }
}

impl Canonize<CanonicalAddr> for HumanAddr {
    fn canonize (&self, api: &impl Api) -> StdResult<CanonicalAddr> {
        canonize_maybe_empty(api, self)
    }
}

impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize (&self, api: &impl Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
}

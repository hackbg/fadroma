//! `HumanAddr`<->`CanonicalAddr` conversion

use crate::scrt::*;

pub trait Humanize<T> {
    fn humanize (&self, api: &impl Api) -> StdResult<T>;
}

impl Humanize<HumanAddr> for CanonicalAddr {
    fn humanize (&self, api: &impl Api) -> StdResult<HumanAddr> {
        humanize_maybe_empty(api, self)
    }
}

impl Humanize<HumanAddr> for &CanonicalAddr {
    fn humanize (&self, api: &impl Api) -> StdResult<HumanAddr> {
        humanize_maybe_empty(api, self)
    }
}

impl<T: Humanize<U>, U> Humanize<Vec<U>> for Vec<T> {
    fn humanize (&self, api: &impl Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.humanize(api)).collect()
    }
}

pub trait Canonize<T> {
    fn canonize (&self, api: &impl Api) -> StdResult<T>;
}

impl Canonize<CanonicalAddr> for HumanAddr {
    fn canonize (&self, api: &impl Api) -> StdResult<CanonicalAddr> {
        canonize_maybe_empty(api, self)
    }
}

impl Canonize<CanonicalAddr> for &HumanAddr {
    fn canonize (&self, api: &impl Api) -> StdResult<CanonicalAddr> {
        canonize_maybe_empty(api, self)
    }
}

impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize (&self, api: &impl Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
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

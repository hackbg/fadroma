//! `HumanAddr`<->`CanonicalAddr` conversion

use secret_cosmwasm_std::{StdResult, HumanAddr, CanonicalAddr, Api};

pub trait Canonize {
    type Output: Humanize;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output>;
}

pub trait Humanize {
    type Output: Canonize;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output>;
}

impl Humanize for CanonicalAddr {
    type Output = HumanAddr;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        humanize_maybe_empty(api, &self)
    }
}

impl Canonize for HumanAddr {
    type Output = CanonicalAddr;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        canonize_maybe_empty(api, &self)
    }
}

impl Humanize for &CanonicalAddr {
    type Output = HumanAddr;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        humanize_maybe_empty(api, self)
    }
}

impl Canonize for &HumanAddr {
    type Output = CanonicalAddr;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        canonize_maybe_empty(api, self)
    }
}

impl<T: Humanize> Humanize for Vec<T> {
    type Output = Vec<T::Output>;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.humanize(api)).collect()
    }
}

impl<T: Canonize> Canonize for Vec<T> {
    type Output = Vec<T::Output>;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.canonize(api)).collect()
    }
}

impl<T: Humanize> Humanize for Option<T> {
    type Output = Option<T::Output>;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        match self {
            Some(item) => Ok(Some(item.humanize(api)?)),
            None => Ok(None)
        }
    }
}

impl<T: Canonize> Canonize for Option<T> {
    type Output = Option<T::Output>;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        match self {
            Some(item) => Ok(Some(item.canonize(api)?)),
            None => Ok(None)
        }
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

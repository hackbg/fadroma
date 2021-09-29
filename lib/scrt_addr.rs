//! `Addr`<->`CanonicalAddr` conversion

use crate::scrt::{Api, StdResult, Addr, CanonicalAddr, Binary};

pub trait Humanize<T> {
    fn humanize (self, api: &dyn Api) -> StdResult<T>;
}

pub trait Canonize<T> {
    fn canonize (&self, api: &dyn Api) -> StdResult<T>;
}

/// Attempting to canonicalize an empty address will fail. 
/// This function skips calling `addr_canonicalize` if the input is empty
/// and returns `CanonicalAddr::default()` instead.
pub fn canonize_maybe_empty(api: &dyn Api, addr: &Addr) -> StdResult<CanonicalAddr> {
    Ok(
        if addr.as_str() == "" {
            CanonicalAddr(Binary(Vec::new()))
        } else {
            api.addr_canonicalize(addr.as_str())?
        }
    )
}

/// Attempting to humanize an empty address will fail. 
/// This function skips calling `addr_humanize` if the input is empty
/// and returns `Addr::default()` instead.
pub fn humanize_maybe_empty(api: &dyn Api, addr: &CanonicalAddr) -> StdResult<Addr> {
    Ok(
        if *addr == CanonicalAddr(Binary(Vec::new())) {
            Addr::unchecked("")
        } else {
            api.addr_humanize(addr)?
        }
    )
}

/// Helper function that validates a collection of expected address strings.
pub fn validate_addresses(api: &dyn Api, mut addresses: Vec<String>) -> StdResult<Vec<Addr>> {
    addresses
        .drain(..)
        .map(|x| api.addr_validate(&x))
        .collect::<StdResult<Vec<Addr>>>()
}

impl Humanize<Addr> for CanonicalAddr {
    fn humanize (self, api: &dyn Api) -> StdResult<Addr> {
        humanize_maybe_empty(api, &self)
    }
}

impl<T: Humanize<U>, U> Humanize<Vec<U>> for Vec<T> {
    fn humanize (mut self, api: &dyn Api) -> StdResult<Vec<U>> {
        self.drain(..).map(|x|x.humanize(api)).collect()
    }
}

impl Canonize<CanonicalAddr> for Addr {
    fn canonize (&self, api: &dyn Api) -> StdResult<CanonicalAddr> {
        canonize_maybe_empty(api, self)
    }
}

impl Canonize<CanonicalAddr> for String {
    fn canonize (&self, api: &dyn Api) -> StdResult<CanonicalAddr> {
        api.addr_canonicalize(self.as_str())
    }
}

impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize (&self, api: &dyn Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
}

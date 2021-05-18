//! `HumanAddr`<->`CanonicalAddr` conversion

use cosmwasm_std::{Api, CanonicalAddr, HumanAddr, StdResult, Storage, Querier, Extern};

pub trait Humanize<T> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<T>;
}
impl<T: Humanize<U>, U> Humanize<Vec<U>> for Vec<T> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.humanize(api)).collect()
    }
}
pub fn humanize <A: Api> (api: &A, addr: &CanonicalAddr) -> StdResult<HumanAddr> {
    if *addr == CanonicalAddr::default() {
        Ok(HumanAddr::default())
    } else {
        api.human_address(addr)
    }
}

pub trait Canonize<T> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<T>;
}
impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
}
pub fn canonize <A: Api> (api: &A, addr: &HumanAddr) -> StdResult<CanonicalAddr> {
    if *addr == HumanAddr::default() {
        Ok(CanonicalAddr::default())
    } else {
        api.canonical_address(addr)
    }
}

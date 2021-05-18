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
pub fn humanize <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>, addr: &CanonicalAddr
) -> StdResult<HumanAddr> {
    if *addr == CanonicalAddr::default() {
        Ok(HumanAddr::default())
    } else {
        deps.api.human_address(addr)
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
pub fn canonize <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>, addr: &HumanAddr
) -> StdResult<CanonicalAddr> {
    if *addr == HumanAddr::default() {
        Ok(CanonicalAddr::default())
    } else {
        deps.api.canonical_address(addr)
    }
}

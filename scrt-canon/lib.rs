//! `HumanAddr`<->`CanonicalAddr` conversion

use cosmwasm_std::{Api, CanonicalAddr, HumanAddr, StdResult, Storage, Querier, Extern};

pub fn humanize <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>, addr: &CanonicalAddr
) -> StdResult<HumanAddr> {
    deps.api.human_addr(addr)?
}

pub trait Humanize<T> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<T>;
}
impl<T: Humanize<U>, U> Humanize<Vec<U>> for Vec<T> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.humanize(api)).collect()
    }
}

pub fn canonize <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>, addr: &HumanAddr
) -> StdResult<CanonicalAddr> {
    deps.api.canon_addr(addr)?
}

pub trait Canonize<T> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<T>;
}
impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
}

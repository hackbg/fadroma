//! `HumanAddr`<->`CanonicalAddr` conversion

use cosmwasm_std::{Api, CanonicalAddr, HumanAddr, StdResult};

pub trait Humanize<T> {
    fn humanize (&self, api: &impl Api) -> StdResult<T>;
}
impl Humanize<HumanAddr> for CanonicalAddr {
    fn humanize (&self, api: &impl Api) -> StdResult<HumanAddr> {
        api.human_address(self)
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
        api.canonical_address(self)
    }
}
impl<T: Canonize<U>, U> Canonize<Vec<U>> for Vec<T> {
    fn canonize (&self, api: &impl Api) -> StdResult<Vec<U>> {
        self.iter().map(|x|x.canonize(api)).collect()
    }
}

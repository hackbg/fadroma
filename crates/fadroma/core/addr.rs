//! `HumanAddr`<->`CanonicalAddr` conversion

use crate::cosmwasm_std::{
    self,
    StdResult, HumanAddr, CanonicalAddr, Api, Uint128, Coin, Binary, Decimal,
    ContractInfo, BlockInfo, MessageInfo, Validator, Delegation, FullDelegation,
    Empty
};

pub trait Canonize {
    type Output: Humanize;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output>;
}

pub trait Humanize {
    type Output: Canonize;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output>;
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

#[macro_export]
macro_rules! impl_canonize_default {
    ($ty: ty) => {
        impl Humanize for $ty {
            type Output = Self;
        
            #[inline(always)]
            fn humanize(self, _api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(self)
            }
        }
        
        impl Canonize for $ty {
            type Output = Self;
        
            #[inline(always)]
            fn canonize(self, _api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(self)
            }
        }
    }
}

impl_canonize_default!(u8);
impl_canonize_default!(u16);
impl_canonize_default!(u32);
impl_canonize_default!(u64);
impl_canonize_default!(u128);
impl_canonize_default!(Uint128);
impl_canonize_default!(Decimal);

impl_canonize_default!(i8);
impl_canonize_default!(i16);
impl_canonize_default!(i32);
impl_canonize_default!(i64);
impl_canonize_default!(i128);

impl_canonize_default!(String);
impl_canonize_default!(char);
impl_canonize_default!(bool);
impl_canonize_default!(isize);
impl_canonize_default!(usize);
impl_canonize_default!(&str);

impl_canonize_default!(Binary);
impl_canonize_default!(Coin);
impl_canonize_default!(BlockInfo);
impl_canonize_default!(ContractInfo);
impl_canonize_default!(MessageInfo);
impl_canonize_default!(Validator);
impl_canonize_default!(Delegation);
impl_canonize_default!(FullDelegation);
impl_canonize_default!(Empty);

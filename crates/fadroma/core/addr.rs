//! `Addr`<->`CanonicalAddr` conversion

use fadroma_platform_scrt::cosmwasm_std::{Delegation, Validator};

use crate::cosmwasm_std::{
    self, Addr, Api, Binary, BlockInfo, CanonicalAddr, Coin, ContractInfo, Decimal, Empty,
    MessageInfo, StdResult, Uint128,
};

pub trait Canonize {
    type Output: Humanize;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output>;
}

pub trait Humanize {
    type Output: Canonize;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output>;
}

/// Attempting to canonicalize an empty address will fail.
/// This function skips calling `canonical_address` if the input is empty
/// and returns `CanonicalAddr::default()` instead.
pub fn canonize_maybe_empty(api: &dyn Api, addr: &Addr) -> StdResult<CanonicalAddr> {
    Ok(if addr.as_str() == "" {
        CanonicalAddr(Binary(Vec::new()))
    } else {
        api.addr_canonicalize(addr.as_str())?
    })
}

/// Attempting to humanize an empty address will fail.
/// This function skips calling `human_address` if the input is empty
/// and returns `Addr::default()` instead.
pub fn humanize_maybe_empty(api: &dyn Api, addr: &CanonicalAddr) -> StdResult<Addr> {
    Ok(if *addr == CanonicalAddr(Binary(Vec::new())) {
        Addr::unchecked("")
    } else {
        api.addr_humanize(addr)?
    })
}

/// Helper function that validates a collection of expected address strings.
pub fn validate_addresses(api: &dyn Api, mut addresses: Vec<String>) -> StdResult<Vec<Addr>> {
    addresses
        .drain(..)
        .map(|x| api.addr_validate(&x))
        .collect::<StdResult<Vec<Addr>>>()
}

impl Humanize for CanonicalAddr {
    type Output = Addr;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        humanize_maybe_empty(api, &self)
    }
}

impl Canonize for Addr {
    type Output = CanonicalAddr;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        canonize_maybe_empty(api, &self)
    }
}

impl Humanize for &CanonicalAddr {
    type Output = Addr;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        humanize_maybe_empty(api, self)
    }
}

impl Canonize for &Addr {
    type Output = CanonicalAddr;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        canonize_maybe_empty(api, self)
    }
}

impl<T: Humanize> Humanize for Vec<T> {
    type Output = Vec<T::Output>;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.humanize(api)).collect()
    }
}

impl<T: Canonize> Canonize for Vec<T> {
    type Output = Vec<T::Output>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.canonize(api)).collect()
    }
}

impl<T: Humanize> Humanize for Option<T> {
    type Output = Option<T::Output>;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        match self {
            Some(item) => Ok(Some(item.humanize(api)?)),
            None => Ok(None),
        }
    }
}

impl<T: Canonize> Canonize for Option<T> {
    type Output = Option<T::Output>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        match self {
            Some(item) => Ok(Some(item.canonize(api)?)),
            None => Ok(None),
        }
    }
}

#[macro_export]
macro_rules! impl_canonize_default {
    ($ty: ty) => {
        impl Humanize for $ty {
            type Output = Self;

            #[inline(always)]
            fn humanize(
                self,
                _api: &dyn cosmwasm_std::Api,
            ) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(self)
            }
        }

        impl Canonize for $ty {
            type Output = Self;

            #[inline(always)]
            fn canonize(
                self,
                _api: &dyn cosmwasm_std::Api,
            ) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(self)
            }
        }
    };
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
impl_canonize_default!(Empty);
impl_canonize_default!(Validator);
impl_canonize_default!(Delegation);
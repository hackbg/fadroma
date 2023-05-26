//! [`cosmwasm_std::Addr`]<->[`cosmwasm_std::CanonicalAddr`] conversion for types that contain addresses.

use crate::cosmwasm_std::{
    self, Addr, Api, Binary, BlockInfo, CanonicalAddr, Coin, Empty,
    StdResult, Uint64, Uint128, Uint256, Uint512, Decimal, Decimal256,
};

use super::sealed;

/// The trait that represents any type which contains a [`cosmwasm_std::Addr`]
/// and needs to be stored since [`cosmwasm_std::Addr`] is usually converted
/// to [`cosmwasm_std::CanonicalAddr`] first. The trait must be implemented on
/// the non-canonical version of the type and the output of [`Canonize::canonize`] must
/// return the canonical version of the same type which is represented by its sister trait
/// [`Humanize`]. This relationship is enforced on the type level since [`Canonize::Output`]
/// must implement [`Humanize`] and vice versa. 
/// 
/// This trait can be **derived** which does this automatically for you, provided that all fields of
/// the given type implement the trait as well. Works on both generic and non-generic structs and enums.
/// For non-generic types it generates a new type with the same name but with the word `Canon` postfix
/// and all of its members have whatever the [`Canonize::Output`] is for their type.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::cosmwasm_std::{self, Addr, CanonicalAddr, Uint128, testing::mock_dependencies};
/// use fadroma::prelude::{Canonize, Humanize};
/// 
/// #[derive(Canonize, Clone, PartialEq, Debug)]
/// struct Account {
///     address: Addr,
///     balance: Uint128,
///     timestamp: u64
/// }
/// 
/// #[derive(Canonize, Clone, PartialEq, Debug)]
/// struct AccountGeneric<T> {
///     address: T,
///     balance: Uint128,
///     timestamp: u64
/// }
/// 
/// let deps = mock_dependencies();
/// let api = deps.as_ref().api;
/// 
/// let account = Account {
///     address: Addr::unchecked("address"),
///     balance: Uint128::new(100),
///     timestamp: 123
/// };
/// 
/// let canonical: AccountCanon = account.clone().canonize(api).unwrap();
/// let humanized = canonical.humanize(api).unwrap();
/// 
/// assert_eq!(account, humanized);
/// 
/// let account = AccountGeneric {
///     address: Addr::unchecked("address"),
///     balance: Uint128::new(100),
///     timestamp: 123
/// };
/// 
/// let canonical: AccountGeneric<CanonicalAddr> = account.clone().canonize(api).unwrap();
/// let humanized = canonical.humanize(api).unwrap();
/// 
/// assert_eq!(account, humanized);
/// ```
pub trait Canonize {
    type Output: Humanize;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output>;
}

/// The trait that represents the canonical version of the given type.
/// See [`Canonize`] for more info.
pub trait Humanize {
    type Output: Canonize;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output>;
}

/// Sealed marker trait for types that *may* represent
/// an address. The types that *may* be a valid address are
/// [`&str`] and [`String`] since they could potentially contain
/// an address. We use [`cosmwasm_std::Api::addr_validate`] or
/// [`cosmwasm_std::Api::addr_canonicalize`] to turn them into
/// [`cosmwasm_std::Addr`] and [`cosmwasm_std::CanonicalAddr`]
/// respectively, both of which definitely *do* contain
/// a valid address and therefore also satisfy this trait.
/// 
/// If you want to constrain your type to contain valid
/// addresses **only**, use [`Address`] instead.
pub trait MaybeAddress: sealed::Sealed { }

/// Sealed marker trait for types that represent a valid address.
/// Those can only be [`cosmwasm_std::Addr`] and [`cosmwasm_std::CanonicalAddr`]
/// and thus are the only types that implement the trait.
/// 
/// If you want to constrain your type to contain addresses
/// that *may* have not be validated (i.e [`&str`] and [`String`]),
/// use [`MaybeAddress`] instead.
pub trait Address: MaybeAddress { }

/// Attempting to canonicalize an empty address will fail.
/// This function skips calling [`cosmwasm_std::Api::addr_canonicalize`]
/// if the input is empty and returns `CanonicalAddr::default()` instead.
pub fn canonize_maybe_empty(api: &dyn Api, addr: &Addr) -> StdResult<CanonicalAddr> {
    Ok(if addr.as_str() == "" {
        CanonicalAddr(Binary(Vec::new()))
    } else {
        api.addr_canonicalize(addr.as_str())?
    })
}

/// Attempting to humanize an empty address will fail.
/// This function skips calling [`cosmwasm_std::Api::addr_humanize`] if the input is empty
/// and returns `Addr::default()` instead.
pub fn humanize_maybe_empty(api: &dyn Api, addr: &CanonicalAddr) -> StdResult<Addr> {
    Ok(if *addr == CanonicalAddr(Binary(Vec::new())) {
        Addr::unchecked("")
    } else {
        api.addr_humanize(addr)?
    })
}

/// Validates a collection of strings that are expected to be valid addresses.
#[inline]
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

impl Humanize for &[CanonicalAddr] {
    type Output = Vec<Addr>;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.humanize(api)).collect()
    }
}

impl Canonize for &[Addr] {
    type Output = Vec<CanonicalAddr>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.canonize(api)).collect()
    }
}

impl Humanize for &[&CanonicalAddr] {
    type Output = Vec<Addr>;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.humanize(api)).collect()
    }
}

impl Canonize for &[&Addr] {
    type Output = Vec<CanonicalAddr>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| x.canonize(api)).collect()
    }
}

impl Canonize for &[String] {
    type Output = Vec<CanonicalAddr>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| api.addr_canonicalize(x)).collect()
    }
}

impl Canonize for &str {
    type Output = CanonicalAddr;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        api.addr_canonicalize(self)
    }
}

impl Canonize for &[&str] {
    type Output = Vec<CanonicalAddr>;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        self.into_iter().map(|x| api.addr_canonicalize(x)).collect()
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

impl sealed::Sealed for &str { }
impl sealed::Sealed for String { }
impl sealed::Sealed for Addr { }
impl sealed::Sealed for CanonicalAddr { }

impl MaybeAddress for &str { }
impl MaybeAddress for String { }
impl MaybeAddress for Addr { }
impl MaybeAddress for CanonicalAddr { }

impl Address for Addr { }
impl Address for CanonicalAddr { }

/// Use on any type that **does not** contain a [`cosmwasm_std::Addr`].
/// The implementation simply returns `Ok(self)` without doing any
/// transformation.
#[macro_export]
macro_rules! impl_canonize_default {
    ($ty: ty) => {
        impl $crate::core::Humanize for $ty {
            type Output = Self;

            #[inline(always)]
            fn humanize(
                self,
                _api: &dyn cosmwasm_std::Api,
            ) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(self)
            }
        }

        impl $crate::core::Canonize for $ty {
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
impl_canonize_default!(Uint64);
impl_canonize_default!(Uint128);
impl_canonize_default!(Uint256);
impl_canonize_default!(Uint512);
impl_canonize_default!(Decimal);
impl_canonize_default!(Decimal256);

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

impl_canonize_default!(Binary);
impl_canonize_default!(Coin);
impl_canonize_default!(BlockInfo);
impl_canonize_default!(Empty);

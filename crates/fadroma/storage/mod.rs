//! Utilities for interacting with the native key-value storage.

mod single_item;
mod item_space;
mod iterable;

pub use single_item::*;
pub use item_space::*;
pub use iterable::*;

use std::{any, convert::{TryFrom, TryInto}};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::cosmwasm_std::{
    Storage, StdResult, StdError, CanonicalAddr,
    Uint64, Uint128, Uint256, Uint512, to_vec, from_slice
};

#[macro_export]
macro_rules! namespace {
    ($visibility:vis $name:ident, $bytes: literal) => {
        $visibility struct $name;

        impl fadroma::storage::Namespace for $name {
            const NAMESPACE: &'static [u8] = $bytes;
        }
    };
}

pub type Segments<'a> = &'a [&'a [u8]];

pub trait Namespace {
    const NAMESPACE: &'static [u8];
}

pub trait Key {
    fn size(&self) -> usize;
    fn write_segments(&self, buf: &mut Vec<u8>);

    #[doc(hidden)]
    fn build(&self, namespace: Option<&[u8]>) -> Vec<u8> {
        let ns_len = namespace.and_then(|x| Some(x.len())).unwrap_or(0);
        let mut key = Vec::with_capacity(self.size() + ns_len);

        if let Some(ns) = namespace {
            key.extend_from_slice(ns);
        }

        self.write_segments(&mut key);

        key
    }
}

pub trait Segment {
    fn size(&self) -> usize;
    fn write_segment(&self, buf: &mut Vec<u8>);
}

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct CompositeKey<'a>(Segments<'a>);

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct StaticKey(pub &'static [u8]);

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct FixedSegmentSizeKey<'a, const N: usize>([&'a [u8]; N]);

pub struct TypedKey<'a, T: Segment + ?Sized>(&'a T);

/// Save something to the storage.
#[inline]
pub fn save<T: Serialize> (
    storage: &mut dyn Storage,
    key: impl AsRef<[u8]>,
    value: &T
) -> StdResult<()> {
    storage.set(key.as_ref(), &to_vec(value)?);

    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove<'a>(
    storage: &mut dyn Storage,
    key: impl AsRef<[u8]>
) {
    storage.remove(key.as_ref());
}

/// Load something from the storage.
#[inline]
pub fn load<'a, T: DeserializeOwned> (
    storage: &dyn Storage,
    key: impl AsRef<[u8]>
) -> StdResult<Option<T>> {
    match storage.get(key.as_ref()) {
        Some(data) => Ok(Some(from_slice(&data)?)),
        None => Ok(None)
    }
}

impl<'a> Key for CompositeKey<'a> {
    #[inline]
    fn size(&self) -> usize {
        self.0.iter().map(|x| x.len()).sum()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        for segment in self.0 {
            buf.extend_from_slice(segment);
        }
    }
}

impl<'a> CompositeKey<'a> {
    #[inline]
    pub fn new(segments: Segments<'a>) -> Self {
        Self(segments)
    }
}

impl<'a> From<Segments<'a>> for CompositeKey<'a> {
    #[inline]
    fn from(segments: Segments<'a>) -> Self {
        Self(segments)
    }
}

impl Key for StaticKey {
    #[inline]
    fn size(&self) -> usize {
        self.0.len()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.0);
    }
}

impl<'a, const N: usize> Key for FixedSegmentSizeKey<'a, N> {
    #[inline]
    fn size(&self) -> usize {
        self.0.iter().map(|x| x.len()).sum()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        for segment in self.0 {
            buf.extend_from_slice(segment);
        }
    }
}

impl<'a, const N: usize> FixedSegmentSizeKey<'a, N> {
    #[inline]
    pub fn new(segments: [&'a [u8]; N]) -> Self {
        Self(segments)
    }
}

impl<'a, const N: usize> From<[&'a [u8]; N]> for FixedSegmentSizeKey<'a, N> {
    #[inline]
    fn from(segments: [&'a [u8]; N]) -> Self {
        Self(segments)
    }
}

impl<'a, const N: usize> TryFrom<Segments<'a>> for FixedSegmentSizeKey<'a, N> {
    type Error = StdError;

    #[inline]
    fn try_from(segments: Segments<'a>) -> Result<Self, Self::Error> {
        let segments: [&'a [u8]; N] = segments.try_into()
            .map_err(|_|
                StdError::invalid_data_size(N, segments.len())
            )?;

        Ok(Self(segments))
    }
}

impl<'a, T: Segment + ?Sized> Key for TypedKey<'a, T> {
    #[inline]
    fn size(&self) -> usize {
        self.0.size()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        self.0.write_segment(buf);
    }
}

impl<'a, T: Segment + ?Sized> From<&'a T> for TypedKey<'a, T> {
    #[inline]
    fn from(value: &'a T) -> Self {
        Self(value)
    }
}

macro_rules! impl_typed_key {
    ($name:ident $(<$lt:lifetime, $($param:ident),+>)+ [$($num:tt),+]) => {
        pub struct $name $(<$lt, $($param: Segment + ?Sized),+>)+ (($($(&$lt $param),+)+));

        impl $(<$lt, $($param: Segment + ?Sized),+>)+ Key for $name $(<$lt, $($param),+>)+ {
            #[inline]
            fn size(&self) -> usize {
                self.0.0.size() $(+ self.0.$num.size())+
            }
        
            #[inline]
            fn write_segments(&self, buf: &mut Vec<u8>) {
                self.0.0.write_segment(buf);
                $(self.0.$num.write_segment(buf);)+
            }
        }

        impl $(<$lt, $($param: Segment + ?Sized),+>)+ From<($($(&$lt $param),+)+)> for $name $(<$lt, $($param),+>)+ {
            #[inline]
            fn from(value: ($($(&$lt $param),+)+)) -> Self {
                Self(value)
            }
        }
    };
}

impl_typed_key!(TypedKey2<'a, T1, T2> [1]);
impl_typed_key!(TypedKey3<'a, T1, T2, T3> [1, 2]);
impl_typed_key!(TypedKey4<'a, T1, T2, T3, T4> [1, 2, 3]);

impl Segment for &str {
    #[inline]
    fn size(&self) -> usize {
        self.as_bytes().len()
    }

    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.as_bytes());
    }
}

impl Segment for String {
    #[inline]
    fn size(&self) -> usize {
        self.as_bytes().len()
    }

    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.as_bytes());
    }
}

impl Segment for CanonicalAddr {
    #[inline]
    fn size(&self) -> usize {
        self.len()
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(&self);
    }
}

macro_rules! impl_num_segment {
    ($data:ty) => {
        impl Segment for $data {
            #[inline]
            fn size(&self) -> usize {
                std::mem::size_of::<Self>()
            }
        
            #[inline]
            fn write_segment(&self, buf: &mut Vec<u8>) {
                buf.extend_from_slice(&self.to_be_bytes());
            }
        }
    };
}

impl_num_segment!(u8);
impl_num_segment!(u16);
impl_num_segment!(u32);
impl_num_segment!(u64);
impl_num_segment!(u128);
impl_num_segment!(Uint64);
impl_num_segment!(Uint128);
impl_num_segment!(Uint256);
impl_num_segment!(Uint512);

#[inline]
fn not_found_error<T>() -> StdError {
    StdError::not_found(format!("Storage load: {}", any::type_name::<T>()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_keys() {
        const WORD: &str = "test";

        fn test(key: impl Key, len: usize) {
            assert_eq!(key.size(), WORD.len() * len);
            assert_eq!(key.build(None), WORD.as_bytes().repeat(len));
        }

        test(TypedKey2::from((&WORD, &WORD)), 2);
        test(TypedKey3::from((&WORD, &WORD, &WORD)), 3);
        test(TypedKey4::from((&WORD, &WORD, &WORD, &WORD)), 4);
    }
}

//! Utilities for interacting with the native key-value storage.

mod single_item;
mod item_space;
mod iterable;

pub use single_item::*;
pub use iterable::*;

use std::{ptr, any, convert::{TryFrom, TryInto}};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::cosmwasm_std::{
    Storage, StdResult, StdError, to_vec, from_slice
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
    fn segments(&self) -> Segments;
}

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct CompositeKey<'a>(Segments<'a>);

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct FixedSegmentSizeKey<'a, const N: usize>([&'a [u8]; N]);

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
    fn segments(&self) -> Segments {
        self.0
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

impl<'a, const N: usize> Key for FixedSegmentSizeKey<'a, N> {
    #[inline]
    fn segments(&self) -> Segments {
        &self.0
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

#[inline]
fn concat(segments: Segments) -> Vec<u8> {
    concat_ns(&[], segments)
}

fn concat_ns(ns: &[u8], segments: Segments) -> Vec<u8> {
    let ns_len = ns.len();
    let segments_len: usize = segments.iter().map(|x| x.len()).sum();

    let mut result = Vec::<u8>::with_capacity(ns_len + segments_len);

    if ns_len > 0 {
        unsafe {
            ptr::copy_nonoverlapping(
                ns.as_ptr(),
                result.as_mut_ptr(),
                ns_len
            );
        }
    }

    let mut offset = ns_len;

    for segment in segments {
        let bytes_len = segment.len();

        unsafe {
            ptr::copy_nonoverlapping(
                segment.as_ptr(),
                result.as_mut_ptr().add(offset),
                bytes_len
            );
        }

        offset += bytes_len;
    }

    result
}

#[inline]
fn not_found_error<T>() -> StdError {
    StdError::not_found(format!("Storage load: {}", any::type_name::<T>()))
}

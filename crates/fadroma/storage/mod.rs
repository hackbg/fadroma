//! Utilities for interacting with the native key-value storage.

mod item;
mod iterable;

pub use item::*;
pub use iterable::*;

use std::{ptr, marker::PhantomData};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::cosmwasm_std::{
    Storage, StdResult, to_vec, from_slice
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

pub trait Namespace {
    const NAMESPACE: &'static [u8];
}

pub trait Key {
    fn stored_key(&self) -> StoredKey;
}

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct StoredKey<'a>(pub &'a [u8]);

#[derive(Clone, Copy, PartialEq, PartialOrd, Hash, Debug)]
pub struct StaticKey(pub &'static [u8]);

#[derive(Clone, PartialEq, PartialOrd, Hash, Debug)]
pub struct CompositeKey<N: Namespace> {
    key: Vec<u8>,
    data: PhantomData<N>
}

/// Save something to the storage.
#[inline]
pub fn save<'a, T: Serialize> (
    storage: &mut dyn Storage,
    key: impl Into<StoredKey<'a>>,
    value: &T
) -> StdResult<()> {
    storage.set(key.into().as_ref(), &to_vec(value)?);

    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove<'a>(
    storage: &mut dyn Storage,
    key: impl Into<StoredKey<'a>>
) {
    storage.remove(key.into().as_ref());
}

/// Load something from the storage.
#[inline]
pub fn load<'a, T: DeserializeOwned> (
    storage: &dyn Storage,
    key: impl Into<StoredKey<'a>>
) -> StdResult<Option<T>> {
    match storage.get(key.into().as_ref()) {
        Some(data) => Ok(Some(from_slice(&data)?)),
        None => Ok(None)
    }
}

fn concat(segments: &[&[u8]]) -> Vec<u8> {
    let total_len = segments.iter().map(|x| x.len()).sum();
    let result = Vec::<u8>::with_capacity(total_len);

    let mut offset = 0;
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

impl Key for StaticKey {
    fn stored_key(&self) -> StoredKey {
        StoredKey(self.0)
    }
}

impl From<&'static [u8]> for StaticKey {
    fn from(key: &'static [u8]) -> Self {
        Self(key)
    }
}

impl AsRef<[u8]> for StaticKey {
    fn as_ref(&self) -> &[u8] {
        self.0
    }
}

impl<N: Namespace> Key for CompositeKey<N> {
    fn stored_key(&self) -> StoredKey {
        StoredKey(&self.key)
    }
}

impl<'a, N: Namespace> Into<StoredKey<'a>> for &'a CompositeKey<N> {
    fn into(self) -> StoredKey<'a> {
        StoredKey(&self.key)
    }
}

impl<N: Namespace, A: AsRef<[u8]>, B: AsRef<[u8]>> Into<CompositeKey<N>> for (A, B) {
    fn into(self) -> CompositeKey<N> {
        CompositeKey {
            key: concat(&[N::NAMESPACE, self.0.as_ref(), self.1.as_ref()]),
            data: PhantomData
        }
    }
}

impl<const N: usize> From<&'static [u8; N]> for StoredKey<'static> {
    fn from(key: &'static [u8; N]) -> Self {
        Self(key.as_slice())
    }
}

impl<'a> From<&'a [u8]> for StoredKey<'a> {
    fn from(key: &'a [u8]) -> Self {
        Self(key)
    }
}

impl<'a> AsRef<[u8]> for StoredKey<'a> {
    fn as_ref(&self) -> &[u8] {
        self.0
    }
}

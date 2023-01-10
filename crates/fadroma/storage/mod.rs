//! Utilities for interacting with the native key-value storage.

mod iterable;

pub use iterable::*;

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::cosmwasm_std::{
    Storage, StdResult, to_vec, from_slice
};

/// Save something to the storage.
#[inline]
pub fn save <T: Serialize> (
    storage: &mut dyn Storage,
    key: &[u8],
    value: &T
) -> StdResult<()> {
    storage.set(key, &to_vec(value)?);

    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove (
    storage: &mut dyn Storage,
    key: &[u8]
) {
    storage.remove(key);
}

/// Load something from the storage.
#[inline]
pub fn load <T: DeserializeOwned> (
    storage: &dyn Storage,
    key: &[u8]
) -> StdResult<Option<T>> {
    match storage.get(key) {
        Some(data) => Ok(Some(from_slice(&data)?)),
        None => Ok(None)
    }
}

/// Save something to the storage under a namespaced key.
#[inline]
pub fn ns_save <T: Serialize> (
    storage: &mut dyn Storage,
    namespace: &[u8],
    key: &[u8],
    value: &T
) -> StdResult<()> {
    storage.set(&concat(namespace, key), &to_vec(value)?);

    Ok(())
}

/// Remove the value of a namespaced key from the storage.
#[inline]
pub fn ns_remove(
    storage: &mut dyn Storage,
    namespace: &[u8],
    key: &[u8]
) {
    storage.remove(&concat(namespace, key));
}

/// Load the value of a namespaced key.
#[inline]
pub fn ns_load <T: DeserializeOwned> (
    storage: &dyn Storage,
    namespace: &[u8],
    key: &[u8]
) -> StdResult<Option<T>> {
    load(storage, &concat(namespace, key))
}

#[inline]
pub(crate) fn concat(
    namespace: &[u8],
    key: &[u8]
) -> Vec<u8> {
    let mut k = namespace.to_vec();
    k.extend_from_slice(key);
    
    k
}

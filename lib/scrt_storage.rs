use std::marker::PhantomData;

use serde::Serialize;
use serde::de::DeserializeOwned;

pub use crate::scrt::{
    ReadonlyStorage, StdResult, Storage,
    StdError, from_slice, to_vec
};

/// Save something to the storage.
#[inline]
pub fn save <T: Serialize, S: Storage> (
    storage: &mut S,
    key:     &[u8],
    value:   &T
) -> StdResult<()> {
    storage.set(key, &to_vec(value)?);
    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove <S: Storage> (
    storage: &mut S,
    key:     &[u8]
) {
    storage.remove(key);
}

/// Load something from the storage.
#[inline]
pub fn load <T: DeserializeOwned, S: ReadonlyStorage> (
    storage: &S,
    key:     &[u8]
) -> StdResult<Option<T>> {
    match storage.get(key) {
        Some(data) => from_slice(&data),
        None => Ok(None)
    }
}

/// Save something to the storage under a namespaced key.
#[inline]
pub fn ns_save <T: Serialize, S: Storage> (
    storage:   &mut S,
    namespace: &[u8],
    key:       &[u8],
    value:     &T
) -> StdResult<()> {
    storage.set(&concat(namespace, key), &to_vec(value)?);
    Ok(())
}

/// Remove the value of a namespaced key from the storage.
#[inline]
pub fn ns_remove <S: Storage> (
    storage:   &mut S,
    namespace: &[u8],
    key:       &[u8]
) {
    let key = concat(namespace, key);
    storage.remove(&key);
}

/// Load the value of a namespaced key.
#[inline]
pub fn ns_load <T: DeserializeOwned, S: ReadonlyStorage> (
    storage:   &S,
    namespace: &[u8],
    key:       &[u8]
) -> StdResult<Option<T>> {
    load(storage, &concat(namespace, key))
}

/// Concatenate a namespace and a key to get a namespaced key.
#[inline]
pub fn concat(
    namespace: &[u8],
    key:       &[u8]
) -> Vec<u8> {
    let mut k = namespace.to_vec();
    k.extend_from_slice(key);
    k
}

/// Stores items in a way that allows for iterating over them.
pub struct IterableStorage<T: DeserializeOwned + Serialize> {
    ns: &'static [u8],
    index: Option<u64>,
    data: PhantomData<T>
}

impl<T: DeserializeOwned + Serialize> IterableStorage<T> {
    const KEY_INDEX: &'static [u8] = b"index";

    /// Creates an instance for the given namespace.
    /// The following namespaces are reserved by `IterableStorage`:
    ///  * `ns` + "index"
    ///  * `ns` + N - where N is a number
    pub fn new(ns: &'static [u8]) -> Self {
        Self {
            ns,
            index: None,
            data: PhantomData
        }
    }

    pub fn iter<'a, S: Storage>(&self, storage: &'a S) -> StdResult<StorageIterator<'a, T, S>> {
        Ok(StorageIterator::new(storage, self.ns, self.len(storage)?))
    }

    /// Returns the index at which the item is stored at.
    pub fn push(&mut self, storage: &mut impl Storage, value: &T) -> StdResult<u64> {
        let index = self.increment_index(storage)?;

        ns_save(storage, self.ns, &index.to_be_bytes(), value)?;

        Ok(index)
    }

    #[inline]
    pub fn get_at(&self, storage: &impl Storage, index: u64) -> StdResult<Option<T>> {
        ns_load(storage, self.ns, &index.to_be_bytes())
    }

    pub fn len(&self, storage: &impl Storage) -> StdResult<u64> {
        if let Some(index) = self.index {
            return Ok(index)
        }

        let result: Option<u64> = ns_load(storage, self.ns, Self::KEY_INDEX)?;

        Ok(result.unwrap_or(0))
    }

    fn increment_index(&mut self, storage: &mut impl Storage) -> StdResult<u64> {
        let prev = self.len(storage)?;
        let index = prev + 1;

        ns_save(storage, self.ns, Self::KEY_INDEX, &index)?;
        self.index = Some(index);

        Ok(prev)
    }
}

pub struct StorageIterator<'a, T: DeserializeOwned, S: Storage> {
    storage: &'a S,
    ns: &'static [u8],
    current: u64,
    end: u64,
    result: PhantomData<T>
}

impl<'a, T: DeserializeOwned, S: Storage> StorageIterator<'a, T, S> {
    pub fn new(storage: &'a S, ns: &'static [u8], len: u64) -> Self {
        Self {
            storage,
            ns,
            current: 0,
            end: len,
            result: PhantomData
        }
    }

    pub fn len(&self) -> u64 {
        self.end
    }
}

impl<'a, T: DeserializeOwned, S: Storage> Iterator for StorageIterator<'a, T, S> {
    type Item = StdResult<T>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        let result: Self::Item = ns_load(
            self.storage,
            &self.ns,
            &self.current.to_be_bytes()
        )
        .map(|x| x.unwrap());

        self.current += 1;

        Some(result)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let len = (self.end - self.current) as usize;
        (len, Some(self.end as usize))
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        self.current = self.current.saturating_add(n as u64);
        self.next()
    }
}

impl<'a, T: DeserializeOwned, S: Storage> DoubleEndedIterator for StorageIterator<'a, T, S> {
    fn next_back(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        self.end -= 1;

        let result: Self::Item = ns_load(
            self.storage,
            &self.ns,
            &self.end.to_be_bytes()
        )
        .map(|x| x.unwrap());

        Some(result)
    }

    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
        self.end = self.end.saturating_sub(n as u64);
        self.next_back()
    }
}

impl<'a, T: DeserializeOwned, S: Storage> ExactSizeIterator for StorageIterator<'a, T, S> { }

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
    len: Option<u64>,
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
            len: None,
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

    /// Removes the item at the end of the collection.
    pub fn pop(&mut self, storage: &mut impl Storage) -> StdResult<()> {
        let index = self.decrement_index(storage)?;
        ns_remove(storage, self.ns, &index.to_be_bytes());

        Ok(())
    }

    #[inline]
    pub fn get_at(&self, storage: &impl Storage, index: u64) -> StdResult<Option<T>> {
        ns_load(storage, self.ns, &index.to_be_bytes())
    }

    pub fn len(&self, storage: &impl Storage) -> StdResult<u64> {
        if let Some(len) = self.len {
            return Ok(len)
        }

        let result: Option<u64> = ns_load(storage, self.ns, Self::KEY_INDEX)?;

        Ok(result.unwrap_or(0))
    }

    fn increment_index(&mut self, storage: &mut impl Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current + 1;

        ns_save(storage, self.ns, Self::KEY_INDEX, &new)?;
        self.len = Some(new);

        Ok(current)
    }

    fn decrement_index(&mut self, storage: &mut impl Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current.saturating_sub(1);

        ns_save(storage, self.ns, Self::KEY_INDEX, &new)?;
        self.len = Some(new);

        Ok(new)
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
        self.end.saturating_sub(self.current)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock_dependencies;

    #[test]
    fn iterable_storage_insertion() {
        let ref mut deps = mock_dependencies(20, &[]);

        let mut storage = IterableStorage::<u8>::new(b"numbers");
        
        for i in 0..5 {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 5);

        storage.pop(&mut deps.storage).unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        // Create new to invalidate cached len
        let mut storage = IterableStorage::<u8>::new(b"numbers");

        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        storage.pop(&mut deps.storage).unwrap();
        assert_eq!(storage.len.unwrap(), 3);
        assert_eq!(storage.len(&deps.storage).unwrap(), 3);

        storage.push(&mut deps.storage, &3).unwrap();
        assert_eq!(storage.len.unwrap(), 4);
        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        let item = storage.get_at(&deps.storage, 0).unwrap();
        assert_eq!(item.unwrap(), 0);

        let item = storage.get_at(&deps.storage, 3).unwrap();
        assert_eq!(item.unwrap(), 3);

        let item = storage.get_at(&deps.storage, 4).unwrap();
        assert!(item.is_none());
    }

    #[test]
    fn iterable_storage_iter() {
        let ref mut deps = mock_dependencies(20, &[]);

        let mut storage = IterableStorage::<u8>::new(b"numbers");
        
        for i in 1..=6 {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        let mut iter = storage.iter(&deps.storage).unwrap();
        assert_eq!(iter.len(), 6);
        
        assert_eq!(iter.next().unwrap().unwrap(), 1);
        assert_eq!(iter.len(), 5);
        assert_eq!(iter.next_back().unwrap().unwrap(), 6);
        assert_eq!(iter.len(), 4);
        assert_eq!(iter.next_back().unwrap().unwrap(), 5);
        assert_eq!(iter.len(), 3);
        assert_eq!(iter.next().unwrap().unwrap(), 2);
        assert_eq!(iter.len(), 2);
        assert_eq!(iter.next().unwrap().unwrap(), 3);
        assert_eq!(iter.len(), 1);
        assert_eq!(iter.next().unwrap().unwrap(), 4);
        assert_eq!(iter.len(), 0);
        assert_eq!(iter.next(), None);
        assert_eq!(iter.len(), 0);
        assert_eq!(iter.next_back(), None);

        let mut iter = storage.iter(&deps.storage).unwrap();
        assert_eq!(iter.nth_back(4).unwrap().unwrap(), 2);
        assert_eq!(iter.nth(0).unwrap().unwrap(), 1);
        assert_eq!(iter.nth_back(0), None);
        assert_eq!(iter.nth(0), None);
    }
}

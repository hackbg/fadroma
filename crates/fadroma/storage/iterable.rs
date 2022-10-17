use std::marker::PhantomData;

use fadroma_platform_scrt::cosmwasm_std::{
    Storage, StdResult, StdError
};
use serde::{Serialize, de::DeserializeOwned};

use super::{ns_load, ns_save, ns_remove};

/// Stores items in a way that allows for iterating over them.
pub struct IterableStorage<'ns ,T: DeserializeOwned + Serialize> {
    ns: &'ns [u8],
    len: Option<u64>,
    data: PhantomData<T>
}

impl<'ns, T: DeserializeOwned + Serialize> IterableStorage<'ns, T> {
    const KEY_INDEX: &'static [u8] = b"index";

    /// Creates an instance for the given namespace.
    /// The following namespaces are reserved by `IterableStorage`:
    ///  * `ns` + "index"
    ///  * `ns` + N - where N is a number
    pub fn new(ns: &'ns [u8]) -> Self {
        Self {
            ns,
            len: None,
            data: PhantomData
        }
    }

    #[inline]
    pub fn iter<'storage>(
        &self,
        storage: &'storage dyn Storage
    ) -> StdResult<StorageIterator<'storage, '_, T>> {
        Ok(StorageIterator::new(storage, &self.ns, self.len(storage)?))
    }

    /// Returns the index at which the item is stored at.
    pub fn push(&mut self, storage: &mut dyn Storage, value: &T) -> StdResult<u64> {
        let index = self.increment_index(storage)?;
        ns_save(storage, self.ns, &index.to_be_bytes(), value)?;

        Ok(index)
    }

    /// Removes the item at the end of the collection.
    pub fn pop(&mut self, storage: &mut dyn Storage) -> StdResult<()> {
        let index = self.decrement_index(storage)?;
        ns_remove(storage, self.ns, &index.to_be_bytes());

        Ok(())
    }

    #[inline]
    pub fn get_at(&self, storage: &dyn Storage, index: u64) -> StdResult<Option<T>> {
        ns_load(storage, self.ns, &index.to_be_bytes())
    }

    /// Returns the value returned by the provided `update` closure or [`None`] if nothing is stored at the given `index`.
    pub fn update_at<F>(
        &self,
        storage: &mut dyn Storage,
        index: u64,
        update: F
    ) -> StdResult<Option<T>>
        where F: FnOnce(T) -> StdResult<T>
    {
        let item = self.get_at(storage, index)?;

        match item {
            Some(item) => {
                let item = update(item)?;
                ns_save(storage, self.ns, &index.to_be_bytes(), &item)?;

                Ok(Some(item))
            },
            None => Ok(None)
        }
    }

    /// Removes the element at the given index.
    /// The removed element is replaced by the last element of the storage.
    /// Does not preserve ordering.
    /// Returns the item that was swapped if such was necessary.
    pub fn swap_remove(&mut self, storage: &mut dyn Storage, index: u64) -> StdResult<Option<T>> {
        const ERR_MSG: &str = "IterableStorage: index out of bounds.";

        let len = self.len(storage)?;

        if len == 0 {
            return Err(StdError::generic_err(ERR_MSG));
        }
        
        let tail = len - 1;

        if index > tail {
            return Err(StdError::generic_err(ERR_MSG));
        } else if tail == index {
            self.pop(storage)?;

            return Ok(None);
        }

        let last_item = self.get_at(storage, tail)?.unwrap();
        ns_save(storage, self.ns, &index.to_be_bytes(), &last_item)?;

        self.pop(storage)?;

        Ok(Some(last_item))
    }

    pub fn len(&self, storage: &dyn Storage) -> StdResult<u64> {
        if let Some(len) = self.len {
            return Ok(len)
        }

        let result: Option<u64> = ns_load(storage, self.ns, Self::KEY_INDEX)?;

        Ok(result.unwrap_or(0))
    }

    fn increment_index(&mut self, storage: &mut dyn Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current + 1;

        ns_save(storage, self.ns, Self::KEY_INDEX, &new)?;
        self.len = Some(new);

        Ok(current)
    }

    fn decrement_index(&mut self, storage: &mut dyn Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current.saturating_sub(1);

        ns_save(storage, self.ns, Self::KEY_INDEX, &new)?;
        self.len = Some(new);

        Ok(new)
    }
}

pub struct StorageIterator<'storage, 'ns, T: DeserializeOwned> {
    storage: &'storage dyn Storage,
    ns: &'ns [u8],
    current: u64,
    end: u64,
    result: PhantomData<T>
}

impl<'storage, 'ns, T: DeserializeOwned> StorageIterator<'storage, 'ns, T> {
    pub fn new(storage: &'storage dyn Storage, ns: &'ns [u8], len: u64) -> Self {
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

impl<'storage, 'ns, T: DeserializeOwned> Iterator for StorageIterator<'storage, 'ns, T> {
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

impl<'storage, 'ns, T: DeserializeOwned> DoubleEndedIterator for StorageIterator<'storage, 'ns, T> {
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

impl<'storage, 'ns, T: DeserializeOwned> ExactSizeIterator for StorageIterator<'storage, 'ns, T> { }

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma_platform_scrt::cosmwasm_std::testing::mock_dependencies;

    #[test]
    fn iterable_storage_insertion() {
        let ref mut deps = mock_dependencies();

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

        let update = |mut x| {
            x += 1;
            Ok(x)
        };

        let result = storage.update_at(&mut deps.storage, 4, update).unwrap();
        assert_eq!(result, None);

        let result = storage.update_at(&mut deps.storage, 3, update).unwrap();
        assert_eq!(result.unwrap(), 4);

        let item = storage.get_at(&deps.storage, 3).unwrap();
        assert_eq!(item.unwrap(), 4);
    }

    #[test]
    fn iterable_storage_iter() {
        let ref mut deps = mock_dependencies();

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

    #[test]
    fn iterable_storage_swap_remove() {
        let ref mut deps = mock_dependencies();
        let mut storage = IterableStorage::<u8>::new(b"numbers");

        for i in 1..=6 {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 6);

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 5);
        let item = storage.get_at(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(item, 6);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get_at(&deps.storage, len - 1).unwrap().unwrap();
        assert_eq!(item, 5);

        let returned_item = storage.swap_remove(&mut deps.storage, 1).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 4);
        let item = storage.get_at(&deps.storage, 1).unwrap().unwrap();
        assert_eq!(item, 5);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get_at(&deps.storage, len - 1).unwrap().unwrap();
        assert_eq!(item, 4);

        let returned_item = storage.swap_remove(&mut deps.storage, 3).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 3);
        let item = storage.get_at(&deps.storage, 2).unwrap().unwrap();
        assert_eq!(item, 3);
        assert!(returned_item.is_none());
        let item = storage.get_at(&deps.storage, len - 2).unwrap().unwrap();
        assert_eq!(item, 5);

        let err = storage.swap_remove(&mut deps.storage, 3).unwrap_err();
        assert_eq!(storage.len(&deps.storage).unwrap(), 3);
        assert_eq!(err, StdError::generic_err("IterableStorage: index out of bounds."));

        let returned_item = storage.swap_remove(&mut deps.storage, 1).unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 2);
        let item = storage.get_at(&deps.storage, 1).unwrap().unwrap();
        assert_eq!(item, 3);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get_at(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(item, 6);

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let item = storage.get_at(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 1);
        assert_eq!(item, 3);
        assert_eq!(item, returned_item.unwrap());

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let item = storage.get_at(&deps.storage, 0).unwrap();
        assert!(item.is_none());
        assert!(returned_item.is_none());
        assert_eq!(storage.len(&deps.storage).unwrap(), 0);

        let num_items: u8 = 20;

        let ref mut deps = mock_dependencies();
        let mut storage = IterableStorage::<u8>::new(b"numbers");

        for i in 0..num_items {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        for i in (0..num_items).rev() {
            let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();

            let len = storage.len(&deps.storage).unwrap();
            
            if len != 0 {
                let item = storage.get_at(&deps.storage, 0).unwrap().unwrap();
                assert_eq!(item, returned_item.unwrap());
                assert_eq!(item, i);
            }
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 0);

        let ref mut deps = mock_dependencies();
        let mut storage = IterableStorage::<u8>::new(b"numbers");

        for i in 0..num_items {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        for i in (0..num_items).rev() {
            let returned_item = storage.swap_remove(&mut deps.storage, i.into()).unwrap();
            assert!(returned_item.is_none());

            let len = storage.len(&deps.storage).unwrap();
            
            if len != 0 {
                let index: u64 = (i - 1).into();
                let item = storage.get_at(&deps.storage, index).unwrap().unwrap();
                assert_eq!(item as u64, index);
            }
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 0);
    }
}

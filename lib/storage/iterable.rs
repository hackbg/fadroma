use std::{mem, marker::PhantomData};

use crate::{
    bin_serde::{FadromaSerialize, FadromaDeserialize},
    cosmwasm_std::{Storage, Deps, DepsMut, StdResult, StdError},
    core::{Canonize, Humanize}
};
use super::{Key, not_found_error};

/// Stores items in a way that allows for iterating over them
/// in a sequential order just like a Vec. It's also possible to
/// retrieve or update inidividual items based on their index.
pub struct IterableStorage<T: FadromaSerialize + FadromaDeserialize, K: Key> {
    ns: K,
    len: Option<u64>,
    data: PhantomData<T>
}

impl<T: FadromaSerialize + FadromaDeserialize, K: Key> IterableStorage<T, K> {
    const KEY_INDEX: &'static [u8] = b"index";
    const ERR_MSG: &str = "IterableStorage: index out of bounds.";

    /// Creates an instance for the given namespace.
    /// The following namespaces are reserved by `IterableStorage`:
    ///  * `ns` + "index"
    ///  * `ns` + n - where n is a number
    #[inline]
    pub fn new(ns: K) -> Self {
        Self {
            ns,
            len: None,
            data: PhantomData
        }
    }

    /// Returns an iterator that iterates through the stored
    /// elements in a sequential order.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// iterable.push(storage, &2)?;
    /// 
    /// let mut iter = iterable.iter(storage)?;
    /// assert_eq!(iter.next().unwrap(), Ok(1));
    /// assert_eq!(iter.next().unwrap(), Ok(2));
    /// assert_eq!(iter.next(), None);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn iter<'storage>(
        &self,
        storage: &'storage dyn Storage
    ) -> StdResult<Iter<'storage, T>> {
        Ok(Iter::new(storage, &self.ns, self.len(storage)?))
    }

    /// Returns the index at which the item is stored at.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// let index = iterable.push(storage, &1)?;
    /// assert_eq!(index, 0);
    /// 
    /// let index = iterable.push(storage, &2)?;
    /// assert_eq!(index, 1);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn push(&mut self, storage: &mut dyn Storage, value: &T) -> StdResult<u64> {
        let index = self.increment_index(storage)?;
        super::save(storage, self.key(index), value)?;

        Ok(index)
    }

    /// Removes the item at the end of the collection.
    /// Does not return the removed element because that
    /// requires a storage read.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// assert_eq!(iterable.len(storage)?, 1);
    /// 
    /// iterable.pop(storage)?;
    /// assert_eq!(iterable.len(storage)?, 0);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn pop(&mut self, storage: &mut dyn Storage) -> StdResult<()> {
        let index = self.decrement_index(storage)?;
        super::remove(storage, self.key(index));

        Ok(())
    }

    /// Retruns the element stored at the given index or [`None`] if the index is out of bounds.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// 
    /// assert_eq!(iterable.get(storage, 0)?, Some(1));
    /// assert_eq!(iterable.get(storage, 1)?, None);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn get(&self, storage: &dyn Storage, index: u64) -> StdResult<Option<T>> {
        super::load(storage, self.key(index))
    }

    #[inline]
    pub fn get_or_error(
        &self,
        storage: &dyn Storage,
        index: u64
    ) -> StdResult<T> {
        let result = self.get(storage, index)?;

        result.ok_or_else(|| not_found_error::<T>())
    }

    #[inline]
    pub fn canonize_and_push<Input: Canonize<Output = T>>(
        &mut self,
        deps: DepsMut,
        item: Input
    ) -> StdResult<u64> {
        let item = item.canonize(deps.api)?;

        self.push(deps.storage, &item)
    }

    #[inline]
    pub fn canonize_and_set<Input: Canonize<Output = T>>(
        &mut self,
        deps: DepsMut,
        index: u64,
        item: Input
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;

        self.set(deps.storage, index, &item)
    }

    /// Overwrites the value at the given index.
    /// Returns and error if the index is out of bounds.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// iterable.push(storage, &1)?;
    /// 
    /// assert_eq!(iterable.get(storage, 0)?, Some(1));
    ///
    /// iterable.set(storage, 0, &2)?;
    /// assert_eq!(iterable.get(storage, 0)?, Some(2));
    /// # Ok(())
    /// # }
    /// ```
    pub fn set(
        &mut self,
        storage: &mut dyn Storage,
        index: u64,
        item: &T
    ) -> StdResult<()> {
        let len = self.len(storage)?;

        if len == 0 || index > len - 1 {
            return Err(StdError::generic_err(Self::ERR_MSG));
        }

        super::save(storage, self.key(index), item)
    }

    /// Returns the value returned by the provided `update` closure or [`None`] if nothing is stored at the given `index`.
    ///
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// 
    /// let add_one = |mut x| {
    ///     x += 1;
    ///     Ok(x)
    /// };
    /// 
    /// let updated_val = iterable.update(storage, 0, add_one)?;
    /// assert_eq!(updated_val, Some(2));
    /// assert_eq!(iterable.get(storage, 0)?, Some(2));
    /// 
    /// let updated_val = iterable.update(storage, 1, add_one)?;
    /// assert_eq!(updated_val, None);
    /// # Ok(())
    /// # }
    /// ```
    pub fn update<F>(
        &self,
        storage: &mut dyn Storage,
        index: u64,
        update: F
    ) -> StdResult<Option<T>>
        where F: FnOnce(T) -> StdResult<T>
    {
        let item = self.get(storage, index)?;

        match item {
            Some(item) => {
                let item = update(item)?;
                super::save(storage, self.key(index), &item)?;

                Ok(Some(item))
            },
            None => Ok(None)
        }
    }

    /// Removes the element at the given index.
    /// The removed element is replaced by the last element in the storage.
    /// Does not preserve ordering.
    /// Returns the item **that was swapped** if such was necessary.
    /// Return an error if the index is out of bounds.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, StdError, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// iterable.push(storage, &2)?;
    /// 
    /// let removed = iterable.swap_remove(storage, 0)?;
    /// // We had to move the number 2 to index 0 so this is what is returned.
    /// assert_eq!(removed, Some(2));
    /// assert_eq!(iterable.len(storage)?, 1);
    /// 
    /// let removed = iterable.swap_remove(storage, 0)?;
    /// // We removed the last element so no reordering was necessary.
    /// assert_eq!(removed, None);
    /// assert_eq!(iterable.len(storage)?, 0);
    /// 
    /// let err = iterable.swap_remove(storage, 0).unwrap_err();
    /// assert_eq!(err, StdError::generic_err("IterableStorage: index out of bounds."));
    /// # Ok(())
    /// # }
    /// ```
    pub fn swap_remove(&mut self, storage: &mut dyn Storage, index: u64) -> StdResult<Option<T>> {
        let len = self.len(storage)?;

        if len == 0 {
            return Err(StdError::generic_err(Self::ERR_MSG));
        }
        
        let tail = len - 1;

        if index > tail {
            return Err(StdError::generic_err(Self::ERR_MSG));
        } else if tail == index {
            self.pop(storage)?;

            return Ok(None);
        }

        let last_item = self.get(storage, tail)?.unwrap();
        super::save(storage, self.key(index), &last_item)?;

        self.pop(storage)?;

        Ok(Some(last_item))
    }

    /// Returns the number of element currently stored.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{iterable::IterableStorage, CompositeKey};
    /// # use fadroma::cosmwasm_std::{StdResult, testing::mock_dependencies};
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// let key = CompositeKey::new(&[b"numbers"]);
    /// let mut iterable = IterableStorage::<u8, _>::new(key);
    /// 
    /// iterable.push(storage, &1)?;
    /// assert_eq!(iterable.len(storage)?, 1);
    /// 
    /// iterable.pop(storage)?;
    /// assert_eq!(iterable.len(storage)?, 0);
    /// # Ok(())
    /// # }
    /// ```
    pub fn len(&self, storage: &dyn Storage) -> StdResult<u64> {
        if let Some(len) = self.len {
            return Ok(len)
        }

        let result: Option<u64> = super::load(storage, self.key_len())?;

        Ok(result.unwrap_or(0))
    }

    fn increment_index(&mut self, storage: &mut dyn Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current + 1;

        super::save(storage, self.key_len(), &new)?;
        self.len = Some(new);

        Ok(current)
    }

    fn decrement_index(&mut self, storage: &mut dyn Storage) -> StdResult<u64> {
        let current = self.len(storage)?;
        let new = current.saturating_sub(1);

        super::save(storage, self.key_len(), &new)?;
        self.len = Some(new);

        Ok(new)
    }

    #[inline]
    fn key(&self, index: u64) -> Vec<u8> {
        let mut key = Vec::with_capacity(self.ns.size() + 8);
        self.ns.write_segments(&mut key);
        key.extend_from_slice(&index.to_be_bytes());

        key
    }

    #[inline]
    fn key_len(&self) -> Vec<u8> {
        let mut key = Vec::with_capacity(self.ns.size() + Self::KEY_INDEX.len());
        self.ns.write_segments(&mut key);
        key.extend_from_slice(Self::KEY_INDEX);
        
        key
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Humanize,
    K: Key
> IterableStorage<T, K> {
    #[inline]
    pub fn get_humanize(
        &self,
        deps: Deps,
        index: u64
    ) -> StdResult<Option<<T as Humanize>::Output>> {
        let result: Option<T> = self.get(deps.storage, index)?;

        match result {
            Some(item) => Ok(Some(item.humanize(deps.api)?)),
            None => Ok(None)
        }
    }

    #[inline]
    pub fn get_humanize_or_error(
        &self,
        deps: Deps,
        index: u64
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.get_humanize(deps, index)?;

        result.ok_or_else(|| not_found_error::<T>())
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Humanize,
    K: Key
> IterableStorage<T, K>
    where <T as Humanize>::Output: Default
{
    #[inline]
    pub fn get_humanize_or_default(
        &self,
        deps: Deps,
        index: u64
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.get_humanize(deps, index)?;

        Ok(result.unwrap_or_default())
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Default,
    K: Key
> IterableStorage<T, K> {
    #[inline]
    pub fn get_or_default(
        &self,
        storage: &dyn Storage,
        index: u64
    ) -> StdResult<T> {
        let result: Option<T> = self.get(storage, index)?;

        Ok(result.unwrap_or_default())
    }
}

/// [`IterableStorage`] iterator. Iterates over values in order.
pub struct Iter<'storage, T: FadromaDeserialize> {
    storage: &'storage dyn Storage,
    ns: Vec<u8>,
    current: u64,
    end: u64,
    result: PhantomData<T>
}

impl<'storage, T: FadromaDeserialize> Iter<'storage, T> {
    pub fn new<K: Key>(storage: &'storage dyn Storage, ns: &K, len: u64) -> Self {
        let mut key = Vec::with_capacity(ns.size() + mem::size_of::<u64>());
        ns.write_segments(&mut key);

        Self {
            storage,
            ns: key,
            current: 0,
            end: len,
            result: PhantomData
        }
    }

    pub fn len(&self) -> u64 {
        self.end.saturating_sub(self.current)
    }

    #[inline]
    fn load_next(&mut self, index: u64) -> StdResult<T> {
        self.ns.extend_from_slice(&index.to_be_bytes());
        let next = super::load(self.storage, &self.ns).map(|x| x.unwrap());

        self.ns.truncate(self.ns.len() - mem::size_of::<u64>());

        next
    }
}

impl<'storage, T: FadromaDeserialize> Iterator for Iter<'storage, T> {
    type Item = StdResult<T>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        let result = self.load_next(self.current);
        self.current += 1;

        Some(result)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let len = self.len() as usize;

        (len, Some(len))
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        self.current = self.current.saturating_add(n as u64);

        self.next()
    }
}

impl<'storage, T: FadromaDeserialize> DoubleEndedIterator for Iter<'storage, T> {
    fn next_back(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        self.end -= 1;
        let result = self.load_next(self.end);

        Some(result)
    }

    #[inline]
    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
        self.end = self.end.saturating_sub(n as u64);

        self.next_back()
    }
}

impl<'storage, T: FadromaDeserialize> ExactSizeIterator for Iter<'storage, T> { }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        cosmwasm_std::testing::mock_dependencies,
        storage::CompositeKey
    };

    #[test]
    fn iterable_storage_insertion() {
        let ref mut deps = mock_dependencies();

        let key = CompositeKey::new(&[b"numbers"]);
        let mut storage = IterableStorage::<u8, _>::new(key);
        
        for i in 0..5 {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 5);

        storage.pop(&mut deps.storage).unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        // Create new to invalidate cached len
        let mut storage = IterableStorage::<u8, _>::new(key);

        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        storage.pop(&mut deps.storage).unwrap();
        assert_eq!(storage.len.unwrap(), 3);
        assert_eq!(storage.len(&deps.storage).unwrap(), 3);

        storage.push(&mut deps.storage, &3).unwrap();
        assert_eq!(storage.len.unwrap(), 4);
        assert_eq!(storage.len(&deps.storage).unwrap(), 4);

        let item = storage.get(&deps.storage, 0).unwrap();
        assert_eq!(item.unwrap(), 0);

        let item = storage.get(&deps.storage, 3).unwrap();
        assert_eq!(item.unwrap(), 3);

        let item = storage.get(&deps.storage, 4).unwrap();
        assert!(item.is_none());

        let update = |mut x| {
            x += 1;
            Ok(x)
        };

        let result = storage.update(&mut deps.storage, 4, update).unwrap();
        assert_eq!(result, None);

        let result = storage.update(&mut deps.storage, 3, update).unwrap();
        assert_eq!(result.unwrap(), 4);

        let item = storage.get(&deps.storage, 3).unwrap();
        assert_eq!(item.unwrap(), 4);

        storage.set(&mut deps.storage, 3, &5).unwrap();
        let item = storage.get(&deps.storage, 3).unwrap();
        assert_eq!(item.unwrap(), 5);

        storage.set(&mut deps.storage, 4, &5).unwrap_err();
        storage.set(&mut deps.storage, 5, &5).unwrap_err();
    }

    #[test]
    fn iterable_storage_iter() {
        let ref mut deps = mock_dependencies();

        let key = CompositeKey::new(&[b"numbers"]);
        let mut storage = IterableStorage::<u8, _>::new(key);
        
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

        let key = CompositeKey::new(&[b"numbers"]);
        let mut storage = IterableStorage::<u8, _>::new(key);

        for i in 1..=6 {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 6);

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 5);
        let item = storage.get(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(item, 6);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get(&deps.storage, len - 1).unwrap().unwrap();
        assert_eq!(item, 5);

        let returned_item = storage.swap_remove(&mut deps.storage, 1).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 4);
        let item = storage.get(&deps.storage, 1).unwrap().unwrap();
        assert_eq!(item, 5);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get(&deps.storage, len - 1).unwrap().unwrap();
        assert_eq!(item, 4);

        let returned_item = storage.swap_remove(&mut deps.storage, 3).unwrap();
        let len = storage.len(&deps.storage).unwrap();
        assert_eq!(len, 3);
        let item = storage.get(&deps.storage, 2).unwrap().unwrap();
        assert_eq!(item, 3);
        assert!(returned_item.is_none());
        let item = storage.get(&deps.storage, len - 2).unwrap().unwrap();
        assert_eq!(item, 5);

        let err = storage.swap_remove(&mut deps.storage, 3).unwrap_err();
        assert_eq!(storage.len(&deps.storage).unwrap(), 3);
        assert_eq!(err, StdError::generic_err("IterableStorage: index out of bounds."));

        let returned_item = storage.swap_remove(&mut deps.storage, 1).unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 2);
        let item = storage.get(&deps.storage, 1).unwrap().unwrap();
        assert_eq!(item, 3);
        assert_eq!(item, returned_item.unwrap());
        let item = storage.get(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(item, 6);

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let item = storage.get(&deps.storage, 0).unwrap().unwrap();
        assert_eq!(storage.len(&deps.storage).unwrap(), 1);
        assert_eq!(item, 3);
        assert_eq!(item, returned_item.unwrap());

        let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();
        let item = storage.get(&deps.storage, 0).unwrap();
        assert!(item.is_none());
        assert!(returned_item.is_none());
        assert_eq!(storage.len(&deps.storage).unwrap(), 0);

        let num_items: u8 = 20;

        let ref mut deps = mock_dependencies();
        let mut storage = IterableStorage::<u8, _>::new(key);

        for i in 0..num_items {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        for i in (0..num_items).rev() {
            let returned_item = storage.swap_remove(&mut deps.storage, 0).unwrap();

            let len = storage.len(&deps.storage).unwrap();
            
            if len != 0 {
                let item = storage.get(&deps.storage, 0).unwrap().unwrap();
                assert_eq!(item, returned_item.unwrap());
                assert_eq!(item, i);
            }
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 0);

        let ref mut deps = mock_dependencies();
        let mut storage = IterableStorage::<u8, _>::new(key);

        for i in 0..num_items {
            storage.push(&mut deps.storage, &i).unwrap();
        }

        for i in (0..num_items).rev() {
            let returned_item = storage.swap_remove(&mut deps.storage, i.into()).unwrap();
            assert!(returned_item.is_none());

            let len = storage.len(&deps.storage).unwrap();
            
            if len != 0 {
                let index: u64 = (i - 1).into();
                let item = storage.get(&deps.storage, index).unwrap().unwrap();
                assert_eq!(item as u64, index);
            }
        }

        assert_eq!(storage.len(&deps.storage).unwrap(), 0);
    }
}

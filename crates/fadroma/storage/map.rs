use std::marker::PhantomData;

use crate::{
    self as fadroma,
    bin_serde::{FadromaSerialize, FadromaDeserialize},
    cosmwasm_std::{Storage, Deps, DepsMut, Binary, StdResult},
    core::{Canonize, Humanize}
};
use super::{
    Namespace, Key, StaticKey,
    iterable::{IterableStorage, Iter},
    serialize, deserialize, not_found_error
};

const KEY_NS: StaticKey = StaticKey(b"key");

/// A key-value storage type that can iterate over all values stored
/// while allowing to arbitrarily insert, get and remove them.
/// If you *don't* need the ability remove values use [`InsertOnlyMap`] instead
/// as it has no overhead. [`Map`] internally stores the key of the item together
/// with the value in order to enable the remove operation.
pub struct Map<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize,
    N: Namespace
> {
    inner: InsertOnlyMap<K, ItemEntry, N>,
    value_data: PhantomData<V>
}

/// A key-value storage type that can iterate over all values stored
/// while allowing to arbitrarily insert get and remove them. This type
/// is more efficient than [`Map`] but it does not allow removing
/// values. If you need to be able to remove values use [`Map`] instead.
pub struct InsertOnlyMap<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize,
    N: Namespace
> {
    iterable: IterableStorage<V, StaticKey>,
    key_data: PhantomData<K>,
    ns_data: PhantomData<N>
}

pub struct MapValueIter<'storage, T: FadromaDeserialize> {
    inner: Iter<'storage, ItemEntry>,
    data: PhantomData<T>
}

#[derive(FadromaSerialize, FadromaDeserialize)]
struct ItemEntry {
    // Using Binary instead of Vec<u8> because the former
    // serializes and deserializes bytes more efficiently.
    // Otherwise, Vec will use the generic implementation
    // which will run on each byte individually instead of
    // the entire slice.

    /// The key that maps to the index in the keys of the map.
    key: Binary,
    item: Binary
}

impl<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize,
    N: Namespace
> Map<K, V, N> {
    /// Creates an instance for the given namespace.
    /// The following namespaces are reserved by `Map`:
    ///  * N + "key" + K,
    ///  * N + "index"
    ///  * N + n - where n is a number
    #[inline]
    pub fn new() -> Self {
        Self {
            inner: InsertOnlyMap::new(),
            value_data: PhantomData
        }
    }

    /// Returns an iterator over all of the values stored by the map.
    #[inline]
    pub fn values<'storage>(
        &self,
        storage: &'storage dyn Storage
    ) -> StdResult<MapValueIter<'storage, V>> {
        Ok(MapValueIter {
            inner: self.inner.iterable.iter(storage)?,
            data: PhantomData
        })
    }

    #[inline]
    pub fn get(&self, storage: &dyn Storage, key: impl Into<K>) -> StdResult<Option<V>> {
        let Ok(Some(entry)) = self.inner.get(storage, key) else {
            return Ok(None);
        };

        let item = deserialize(&entry.item.0)?;

        Ok(Some(item))
    }

    #[inline]
    pub fn get_or_error(&self, storage: &dyn Storage, key: impl Into<K>) -> StdResult<V> {
        let result = self.get(storage, key)?;

        result.ok_or_else(|| not_found_error::<V>())
    }

    #[inline]
    pub fn canonize_and_insert<Input: Canonize<Output = V>>(
        &mut self,
        deps: DepsMut,
        key: impl Into<K>,
        item: Input
    ) -> StdResult<bool> {
        let item = item.canonize(deps.api)?;

        self.insert(deps.storage, key, &item)
    }

    /// Inserts a new value into the map. Returns `true` if a value
    /// was previously stored under the given key.
    #[inline]
    pub fn insert(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        value: &V
    ) -> StdResult<bool> {
        let item = ItemEntry {
            key: Binary(self.inner.map_key(key)),
            item: Binary(serialize(value)?)
        };

        self.inner.insert_impl(storage, &item.key.0, &item)
            .map(|x| x.is_none())
    }

    #[inline]
    pub fn remove(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>
    ) -> StdResult<bool> {
        let key = self.inner.map_key(key);
        let exists = match self.inner.load_index(storage, &key)? {
            Some(index) => {
                storage.remove(&key);

                if let Some(swapped) = self.inner.iterable.swap_remove(storage, index)? {
                    self.inner.save_index(storage, &swapped.key.0, index)?;
                }

                true
            }
            None => false
        };

        Ok(exists)
    }
}

impl<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize,
    N: Namespace
> InsertOnlyMap<K, V, N> {
    /// Creates an instance for the given namespace.
    /// The following namespaces are reserved by `Map`:
    ///  * N + "key" + K,
    ///  * N + "index"
    ///  * N + n - where n is a number
    #[inline]
    pub fn new() -> Self {
        Self {
            iterable: IterableStorage::new(StaticKey(N::NAMESPACE)),
            key_data: PhantomData,
            ns_data: PhantomData,
        }
    }

    /// Returns an iterator over all of the values stored by the map.
    #[inline]
    pub fn values<'storage>(
        &self,
        storage: &'storage dyn Storage
    ) -> StdResult<Iter<'storage, V>> {
        self.iterable.iter(storage)
    }

    /// Inserts the given value into the map. Returns the index at which
    /// the value was stored. If the value *was updated* instead, it will return `None`.
    /// The index can be used to call [`InsertOnlyMap::get_by_index`] as an optimization
    /// to avoid loading it internally using a key which is what [`InsertOnlyMap::get`] does.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdError,
    /// #     testing::mock_dependencies
    /// # };
    /// 
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let index = map.insert(storage, &key, &1).unwrap();
    /// 
    /// // We inserted a new value, so the index is returned.
    /// assert_eq!(index, Some(0));
    /// 
    /// let index = map.insert(storage, &key, &2).unwrap();
    /// 
    /// // We are updating an existing value, so no index is returned.
    /// assert_eq!(index, None);
    #[inline]
    pub fn insert(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        value: &V
    ) -> StdResult<Option<u64>> {
        self.insert_impl(storage, &self.map_key(key), value)
    }

    #[inline]
    pub fn get(&self, storage: &dyn Storage, key: impl Into<K>) -> StdResult<Option<V>> {
        let key = self.map_key(key);
        
        match self.load_index(storage, &key)? {
            Some(index) => self.iterable.get(storage, index),
            None => Ok(None)
        }
    }

    /// Gets the value using the index at which the value was stored.
    /// Internally the key maps to the index which itself maps to the value.
    /// So if you have the index, you can skip loading the key and try getting
    /// the value directly. The index is returned by the [`InsertOnlyMap::insert`] method.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdError,
    /// #     testing::mock_dependencies
    /// # };
    /// 
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let index = map.insert(storage, &key, &1).unwrap();
    /// assert_eq!(index, Some(0));
    /// 
    /// let value = map.get_by_index(storage, index.unwrap()).unwrap();
    /// assert_eq!(value, Some(1));
    /// 
    /// // Try to get a non-existent index.
    /// let value = map.get_by_index(storage, 1).unwrap();
    /// assert_eq!(value, None);
    /// ```
    #[inline]
    pub fn get_by_index(&self, storage: &dyn Storage, index: u64) -> StdResult<Option<V>> {
        self.iterable.get(storage, index)
    }

    #[inline]
    pub fn get_or_error(&self, storage: &dyn Storage, key: impl Into<K>) -> StdResult<V> {
        let result = self.get(storage, key)?;

        result.ok_or_else(|| not_found_error::<V>())
    }

    /// Canonizes the given value and inserts it into the map. Returns the index at which
    /// the value was stored. If the value *was updated* instead, it will return `None`.
    /// The index can be used to call [`InsertOnlyMap::get_by_index`] as an optimization
    /// to avoid loading it internally using a key which is what [`InsertOnlyMap::get`] does.
    #[inline]
    pub fn canonize_and_insert<Input: Canonize<Output = V>>(
        &mut self,
        deps: DepsMut,
        key: impl Into<K>,
        item: Input
    ) -> StdResult<Option<u64>> {
        let item = item.canonize(deps.api)?;

        self.insert(deps.storage, key, &item)
    }

    fn insert_impl(
        &mut self,
        storage: &mut dyn Storage,
        key: &[u8],
        value: &V
    ) -> StdResult<Option<u64>> {
        let index = match self.load_index(storage, key)? {
            Some(index) => {
                self.iterable.set(storage, index, value)?;

                None
            }
            None => {
                let index = self.iterable.push(storage, value)?;
                self.save_index(storage, key, index)?;

                Some(index)
            }
        };

        Ok(index)
    }

    #[inline]
    fn load_index(&self, storage: &dyn Storage, key: &[u8]) -> StdResult<Option<u64>> {
        super::load(storage, key)
    }

    #[inline]
    fn save_index(
        &self,
        storage: &mut dyn Storage,
        key: &[u8],
        index: u64
    ) -> StdResult<()> {
        super::save(storage, key, &index)
    }

    fn map_key(&self, key: impl Into<K>) -> Vec<u8> {
        let key = key.into();

        let mut map_key = Vec::with_capacity(
            N::NAMESPACE.len() +
            KEY_NS.size() +
            key.size()
        );
        map_key.extend_from_slice(N::NAMESPACE);
        map_key.extend_from_slice(KEY_NS.0);
        key.write_segments(&mut map_key);

        map_key
    }
}

macro_rules! impl_get_extensions {
    ($map:ident) => {
        impl<
            K: Key,
            V: FadromaSerialize + FadromaDeserialize + Humanize,
            N: Namespace
        > $map<K, V, N> {
            #[inline]
            pub fn get_humanize(
                &self,
                deps: Deps,
                key: impl Into<K>
            ) -> StdResult<Option<<V as Humanize>::Output>> {
                let result: Option<V> = self.get(deps.storage, key)?;

                match result {
                    Some(item) => Ok(Some(item.humanize(deps.api)?)),
                    None => Ok(None)
                }
            }

            #[inline]
            pub fn get_humanize_or_error(
                &self,
                deps: Deps,
                key: impl Into<K>
            ) -> StdResult<<V as Humanize>::Output> {
                let result = self.get_humanize(deps, key)?;

                result.ok_or_else(|| not_found_error::<V>())
            }
        }

        impl<
            K: Key,
            V: FadromaSerialize + FadromaDeserialize + Humanize,
            N: Namespace
        > $map<K, V, N>
            where <V as Humanize>::Output: Default
        {
            #[inline]
            pub fn get_humanize_or_default(
                &self,
                deps: Deps,
                key: impl Into<K>
            ) -> StdResult<<V as Humanize>::Output> {
                let result = self.get_humanize(deps, key)?;

                Ok(result.unwrap_or_default())
            }
        }

        impl<
            K: Key,
            V: FadromaSerialize + FadromaDeserialize + Default,
            N: Namespace
        > $map<K, V, N> {
            #[inline]
            pub fn get_or_default(
                &self,
                storage: &dyn Storage,
                key: impl Into<K>,
            ) -> StdResult<V> {
                let result: Option<V> = self.get(storage, key)?;

                Ok(result.unwrap_or_default())
            }
        }
    }
}

impl_get_extensions!(Map);
impl_get_extensions!(InsertOnlyMap);

impl<'storage, T: FadromaDeserialize> MapValueIter<'storage, T> {
    #[inline]
    fn deserialize_value(
        &self,
        entry: Option<StdResult<ItemEntry>>
    ) -> Option<StdResult<T>> {
        entry.and_then(|x|
            Some(x.and_then(|value|
                deserialize(&value.item.0))
            )
        )
    }
}

impl<'storage, T: FadromaDeserialize> Iterator for MapValueIter<'storage, T> {
    type Item = StdResult<T>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        let entry = <Iter<'storage, ItemEntry> as Iterator>::next(&mut self.inner);

        self.deserialize_value(entry)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        <Iter<'storage, ItemEntry> as Iterator>::size_hint(&self.inner)
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        let entry = <Iter<'storage, ItemEntry> as Iterator>::nth(&mut self.inner, n);

        self.deserialize_value(entry)
    }
}

impl<'storage, T: FadromaDeserialize> DoubleEndedIterator for MapValueIter<'storage, T> {
    #[inline]
    fn next_back(&mut self) -> Option<Self::Item> {
        let entry = <Iter<'storage, ItemEntry> as DoubleEndedIterator>::next_back(&mut self.inner);

        self.deserialize_value(entry)
    }

    #[inline]
    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
        let entry = <Iter<'storage, ItemEntry> as DoubleEndedIterator>::nth_back(&mut self.inner, n);

        self.deserialize_value(entry)
    }
}

impl<'storage, T: FadromaDeserialize> ExactSizeIterator for MapValueIter<'storage, T> { }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        cosmwasm_std::testing::mock_dependencies,
        storage::TypedKey,
        namespace
    };

    namespace!(TestNs, b"test");

    macro_rules! test_iter {
        ($map:ident) => {
            let storage = &mut mock_dependencies().storage as &mut dyn Storage;
            let mut map = $map::<TypedKey<String>, u8, TestNs>::new();
            
            let keys = ["one", "two", "three", "four", "five", "six"]
                .into_iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>();
    
            for (i, key) in keys.iter().enumerate() {
                let num = i as u8 + 1;
                map.insert(storage, key, &num).unwrap();
            }
    
            let mut iter = map.values(storage).unwrap();
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
    
            let mut iter = map.values(storage).unwrap();
            assert_eq!(iter.nth_back(4).unwrap().unwrap(), 2);
            assert_eq!(iter.nth(0).unwrap().unwrap(), 1);
            assert_eq!(iter.nth_back(0), None);
            assert_eq!(iter.nth(0), None);
        };
    }

    #[test]
    fn insert_only_map_values_iter() {
        test_iter!(InsertOnlyMap);
    }

    #[test]
    fn map_values_iter() {
        test_iter!(Map);
    }

    #[test]
    fn insert_only_map_insert_get() {
        let storage = &mut mock_dependencies().storage as &mut dyn Storage;
        let mut map = InsertOnlyMap::<TypedKey<String>, u8, TestNs>::new();

        let keys = ["one", "two", "three"]
            .into_iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        for (i, key) in keys.iter().enumerate() {
            let num = i as u8 + 1;
            assert_eq!(map.insert(storage, key, &num).unwrap(), Some(i as u64));

            let raw_key = map.map_key(&keys[i]);
            assert_eq!(map.insert_impl(storage, &raw_key, &num).unwrap(), None);

            assert_eq!(
                raw_key,
                [TestNs::NAMESPACE, KEY_NS.0, &keys[i].as_bytes()].concat()
            );

            let value = map.get(storage, key).unwrap();
            assert_eq!(value, Some(num));

            let value = map.get_by_index(storage, i as u64).unwrap();
            assert_eq!(value, Some(num));
        }

        let key = "four".to_string();
        assert_eq!(map.get(storage, &key).unwrap(), None);

        assert_eq!(map.get_by_index(storage, key.len() as u64).unwrap(), None);
    }

    #[test]
    fn map_insert_get() {
        let storage = &mut mock_dependencies().storage as &mut dyn Storage;
        let mut map = Map::<TypedKey<String>, u8, TestNs>::new();

        let keys = ["one", "two", "three"]
            .into_iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        for (i, key) in keys.iter().enumerate() {
            let num = i as u8 + 1;
            assert!(!map.insert(storage, key, &num).unwrap());
            assert!(map.insert(storage, key, &num).unwrap());

            let value = map.get(storage, key).unwrap();
            assert_eq!(value, Some(num));
        }

        let key = "four".to_string();
        assert_eq!(map.get(storage, &key).unwrap(), None);
    }

    #[test]
    fn map_remove() {
        let storage = &mut mock_dependencies().storage as &mut dyn Storage;
        let mut map = Map::<TypedKey<String>, u8, TestNs>::new();

        let keys = ["one", "two", "three"]
            .into_iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        for (i, key) in keys.iter().enumerate() {
            let num = i as u8 + 1;
            assert!(!map.insert(storage, key, &num).unwrap());

            let value = map.get(storage, key).unwrap();
            assert_eq!(value, Some(num));

            assert_eq!(map.remove(storage, key), Ok(true));
            assert_eq!(map.get(storage, key).unwrap(), None);

            assert_eq!(map.remove(storage, key), Ok(false));
        }

        let key = "four".to_string();
        assert_eq!(map.remove(storage, &key), Ok(false));

        let iter_next = map.values(storage).unwrap().next();
        assert!(iter_next.is_none());
    }
}

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
/// If you *don't* need the ability to remove values use [`InsertOnlyMap`] instead
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
/// while allowing to arbitrarily insert and get them. This type
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

/// Iterator over the values of [`Map`].
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

    /// Returns a tuple where the first member indicates whether the given value was inserted.
    /// The second member is the value itself, either loaded from storage or the `value` parameter.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::Map, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = Map::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let (is_new, value) = map.get_or_insert(storage, &key, 5)?;
    /// 
    /// // Value wasn't previously present in the map.
    /// assert_eq!(is_new, true);
    /// assert_eq!(value, 5);
    /// 
    /// let (is_new, value) = map.get_or_insert(storage, &key, 10)?;
    /// 
    /// // Value is now present and so the 10 is not inserted.
    /// assert_eq!(is_new, false);
    /// assert_eq!(value, 5);
    /// # Ok(())
    /// # }
    /// ```
    pub fn get_or_insert(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        value: V
    ) -> StdResult<(bool, V)> {
        let key = key.into();
        if let Some(result) = self.get_impl(storage, &key)? {
            return Ok((false, result));
        }

        let item = self.encode_item(&key, &value)?;
        self.inner.push_item(storage, &item.key.0, &item)?;

        Ok((true, value))
    }

    /// Returns a tuple where the first member indicates whether the given value was inserted.
    /// The second member is the value itself, either loaded from storage or computed from the provided closure.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::Map, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = Map::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let (is_new, value) = map.get_or_insert_with(storage, &key, || 5)?;
    /// 
    /// // Value wasn't previously present in the map.
    /// assert_eq!(is_new, true);
    /// assert_eq!(value, 5);
    /// 
    /// let (is_new, value) = map.get_or_insert_with(storage, &key, || 10)?;
    /// 
    /// // Value is now present and so the 10 is not inserted.
    /// assert_eq!(is_new, false);
    /// assert_eq!(value, 5);
    /// # Ok(())
    /// # }
    /// ```
    pub fn get_or_insert_with(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        func: impl FnOnce() -> V
    ) -> StdResult<(bool, V)> {
        let key = key.into();
        if let Some(result) = self.get_impl(storage, &key)? {
            return Ok((false, result));
        }

        let value = func();
        let item = self.encode_item(&key, &value)?;
        self.inner.push_item(storage, &item.key.0, &item)?;

        Ok((true, value))
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
        let item = self.encode_item(&key.into(), value)?;

        self.inner.insert_impl(storage, &item.key.0, &item)
            .map(|x| x.is_none())
    }

    #[inline]
    pub fn remove(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>
    ) -> StdResult<bool> {
        let key = self.inner.map_key(&key.into());
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

    #[inline]
    fn get_impl(&self, storage: &dyn Storage, key: &K) -> StdResult<Option<V>> {
        let Ok(Some(entry)) = self.inner.get_impl(storage, key) else {
            return Ok(None);
        };

        let item = deserialize(&entry.item.0)?;

        Ok(Some(item))
    }

    #[inline]
    fn encode_item(&self, key: &K, value: &V) -> StdResult<ItemEntry> {
        Ok(ItemEntry {
            key: Binary(self.inner.map_key(key)),
            item: Binary(serialize(value)?)
        })
    }
}

impl<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize + Default,
    N: Namespace
> Map<K, V, N> {
    /// Returns a tuple where the first member indicates whether the given value was inserted.
    /// The second member is the value itself, either loaded from storage or the default value for the type.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::Map, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = Map::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// 
    /// let value = map.get(storage, &key)?;
    /// // No value stored at this key.
    /// assert!(value.is_none());
    /// 
    /// let (is_new, value) = map.get_or_insert_default(storage, &key)?;
    /// 
    /// // We've now inserted the default value for u8 which is 0.
    /// assert_eq!(is_new, true);
    /// assert_eq!(value, 0);
    /// 
    /// let value = map.get(storage, &key)?;
    /// assert_eq!(value, Some(0));
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn get_or_insert_default(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>
    ) -> StdResult<(bool, V)> {
        self.get_or_insert_with(storage, key, || V::default())
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
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let index = map.insert(storage, &key, &1)?;
    /// 
    /// // We inserted a new value, so the index is returned.
    /// assert_eq!(index, Some(0));
    /// 
    /// let index = map.insert(storage, &key, &2)?;
    /// 
    /// // We are updating an existing value, so no index is returned.
    /// assert_eq!(index, None);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn insert(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        value: &V
    ) -> StdResult<Option<u64>> {
        let key = self.map_key(&key.into());

        self.insert_impl(storage, &key, value)
    }

    #[inline]
    pub fn get(&self, storage: &dyn Storage, key: impl Into<K>) -> StdResult<Option<V>> {
        self.get_impl(storage, &key.into())
    }

    /// Returns a tuple where the first member is the index of the value if it was inserted.
    /// The second member is the value itself, either loaded from storage or the `value` parameter.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let (index, value) = map.get_or_insert(storage, &key, 5)?;
    /// 
    /// // Value wasn't previously present in the map.
    /// assert_eq!(index, Some(0));
    /// assert_eq!(value, 5);
    /// 
    /// let (index, value) = map.get_or_insert(storage, &key, 10)?;
    /// 
    /// // Value is now present and so the 10 is not inserted.
    /// assert_eq!(index, None);
    /// assert_eq!(value, 5);
    /// # Ok(())
    /// # }
    /// ```
    pub fn get_or_insert(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        value: V
    ) -> StdResult<(Option<u64>, V)> {
        let key = key.into();
        if let Some(result) = self.get_impl(storage, &key)? {
            return Ok((None, result));
        }

        let key = self.map_key(&key);
        let index = self.push_item(storage, &key, &value)?;

        Ok((Some(index), value))
    }

    /// Returns a tuple where the first member is the index of the value if it was inserted.
    /// The second member is the value itself, either loaded from storage or computed from the provided closure.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let (index, value) = map.get_or_insert_with(storage, &key, || 5)?;
    /// 
    /// // Value wasn't previously present in the map.
    /// assert_eq!(index, Some(0));
    /// assert_eq!(value, 5);
    /// 
    /// let (index, value) = map.get_or_insert_with(storage, &key, || 10)?;
    /// 
    /// // Value is now present and so the 10 is not inserted.
    /// assert_eq!(index, None);
    /// assert_eq!(value, 5);
    /// # Ok(())
    /// # }
    /// ```
    pub fn get_or_insert_with(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        func: impl FnOnce() -> V
    ) -> StdResult<(Option<u64>, V)> {
        let key = key.into();
        if let Some(result) = self.get_impl(storage, &key)? {
            return Ok((None, result));
        }

        let value = func();
        let key = self.map_key(&key);
        let index = self.push_item(storage, &key, &value)?;

        Ok((Some(index), value))
    }

    /// Gets the value using the index at which the value was stored.
    /// Internally the key maps to the index which itself maps to the value.
    /// So if you have the index, you can skip loading the key and try getting
    /// the value directly. The index is returned by all methods that can insert values.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// let index = map.insert(storage, &key, &1)?;
    /// assert_eq!(index, Some(0));
    /// 
    /// let value = map.get_by_index(storage, index.unwrap())?;
    /// assert_eq!(value, Some(1));
    /// 
    /// // Try to get a non-existent index.
    /// let value = map.get_by_index(storage, 1)?;
    /// assert_eq!(value, None);
    /// # Ok(())
    /// # }
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

    #[inline]
    fn get_impl(&self, storage: &dyn Storage, key: &K) -> StdResult<Option<V>> {
        let key = self.map_key(key);
        
        match self.load_index(storage, &key)? {
            Some(index) => self.iterable.get(storage, index),
            None => Ok(None)
        }
    }

    #[inline]
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
                let index = self.push_item(storage, key, value)?;

                Some(index)
            }
        };

        Ok(index)
    }

    #[inline]
    fn push_item(
        &mut self,
        storage: &mut dyn Storage,
        key: &[u8],
        value: &V
    ) -> StdResult<u64> {
        let index = self.iterable.push(storage, value)?;
        self.save_index(storage, key, index)?;

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

    fn map_key(&self, key: &K) -> Vec<u8> {
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

impl<
    K: Key,
    V: FadromaSerialize + FadromaDeserialize + Default,
    N: Namespace
> InsertOnlyMap<K, V, N> {
    /// Returns a tuple where the first member is the index of the value if it was inserted.
    /// The second member is the value itself, either loaded from storage or the default value for the type.
    /// 
    /// # Examples
    /// 
    /// ```
    /// # use fadroma::storage::{map::InsertOnlyMap, TypedKey};
    /// # use fadroma::cosmwasm_std::{
    /// #     StdResult,
    /// #     testing::mock_dependencies
    /// # };
    /// # fn main() -> StdResult<()> {
    /// # let mut deps = mock_dependencies();
    /// # let storage = deps.as_mut().storage;
    /// fadroma::namespace!(NumbersNs, b"numbers");
    /// let mut map = InsertOnlyMap::<TypedKey<String>, u8, NumbersNs>::new();
    /// 
    /// let key = "one".to_string();
    /// 
    /// let value = map.get(storage, &key)?;
    /// // No value stored at this key.
    /// assert!(value.is_none());
    /// 
    /// let (index, value) = map.get_or_insert_default(storage, &key)?;
    /// 
    /// // We've now inserted the default value for u8 which is 0.
    /// assert_eq!(index, Some(0));
    /// assert_eq!(value, 0);
    /// 
    /// let value = map.get(storage, &key)?;
    /// assert_eq!(value, Some(0));
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn get_or_insert_default(
        &mut self,
        storage: &mut dyn Storage,
        key: impl Into<K>
    ) -> StdResult<(Option<u64>, V)> {
        self.get_or_insert_with(storage, key, || V::default())
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
    fn insert_only_map_get_or() {
        let storage = &mut mock_dependencies().storage as &mut dyn Storage;
        let mut map = InsertOnlyMap::<TypedKey<String>, u8, TestNs>::new();

        let keys = ["one", "two", "three", "four"]
            .into_iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        let take = 2;
        for (i, key) in keys.iter().enumerate().take(take) {
            let num = i as u8;
            let (index, value) = map.get_or_insert(storage, key, num).unwrap();

            assert_eq!(index, Some(i as u64));
            assert_eq!(value, num);

            let (index, value) = map.get_or_insert(storage, key, num + 1).unwrap();
            assert_eq!(index, None);
            assert_eq!(value, num);
        }

        for (i, key) in keys.iter().skip(2).enumerate() {
            let num = i as u8;
            let (index, value) = map.get_or_insert_with(storage, key, || num).unwrap();

            assert_eq!(index, Some((i + take) as u64));
            assert_eq!(value, num);

            let (index, value) = map.get_or_insert_with(storage, key, || num + 1).unwrap();
            assert_eq!(index, None);
            assert_eq!(value, num);
        }

        let (index, value) = map.get_or_insert_default(storage, &keys[1]).unwrap();
        assert_eq!(index, None);
        assert_eq!(value, 1);

        let (index, value) = map.get_or_insert_default(storage, &"five".to_string()).unwrap();
        assert_eq!(index.unwrap(), keys.len() as u64);
        assert_eq!(value, 0);
    }

    #[test]
    fn map_get_or() {
        let storage = &mut mock_dependencies().storage as &mut dyn Storage;
        let mut map = Map::<TypedKey<String>, u8, TestNs>::new();

        let keys = ["one", "two", "three", "four"]
            .into_iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        let take = 2;
        for (i, key) in keys.iter().enumerate().take(take) {
            let num = i as u8;
            let (is_new, value) = map.get_or_insert(storage, key, num).unwrap();

            assert_eq!(is_new, true);
            assert_eq!(value, num);

            let (is_new, value) = map.get_or_insert(storage, key, num + 1).unwrap();
            assert_eq!(is_new, false);
            assert_eq!(value, num);
        }

        for (i, key) in keys.iter().skip(2).enumerate() {
            let num = i as u8;
            let (is_new, value) = map.get_or_insert_with(storage, key, || num).unwrap();

            assert_eq!(is_new, true);
            assert_eq!(value, num);

            let (is_new, value) = map.get_or_insert_with(storage, key, || num + 1).unwrap();
            assert_eq!(is_new, false);
            assert_eq!(value, num);
        }

        let (is_new, value) = map.get_or_insert_default(storage, &keys[1]).unwrap();
        assert_eq!(is_new, false);
        assert_eq!(value, 1);

        let (is_new, value) = map.get_or_insert_default(storage, &"five".to_string()).unwrap();
        assert_eq!(is_new, true);
        assert_eq!(value, 0);
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

            let raw_key = map.map_key(&TypedKey(&keys[i]));
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

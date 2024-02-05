use std::marker::PhantomData;

use crate::{
    core::{Humanize, Canonize},
    bin_serde::{FadromaSerialize, FadromaDeserialize},
    cosmwasm_std::{Deps, DepsMut, Storage, StdResult}
};
use super::{Key, Namespace, not_found_error};

/// Storage type that stores many items under the given [`Namespace`].
/// The key can be anything that implements [`Key`] and the most suitable
/// type of key should be chosen depending on the scenario.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::{
///     cosmwasm_std::{
///         CanonicalAddr, Api,
///         testing::mock_dependencies
///     },
///     storage::{ItemSpace, TypedKey2}
/// };
/// 
/// fadroma::namespace!(NumbersNs, b"numbers");
/// const NUMBERS: ItemSpace::<u64, NumbersNs, TypedKey2<CanonicalAddr, u8>> = ItemSpace::new();
/// 
/// let mut deps = mock_dependencies();
/// 
/// let address = deps.api.addr_canonicalize("user").unwrap();
/// let index = 1u8;
/// 
/// let storage = deps.as_mut().storage;
/// 
/// NUMBERS.save(storage, (&address, &index), &100).unwrap();
/// 
/// let stored = NUMBERS.load_or_default(storage, (&address, &index)).unwrap();
/// assert_eq!(stored, 100);
/// 
/// let index = 2u8;
/// let stored = NUMBERS.load(storage, (&address, &index)).unwrap();
/// assert!(stored.is_none());
/// 
/// ```
pub struct ItemSpace<T: FadromaSerialize + FadromaDeserialize, N: Namespace, K: Key> {
    namespace_data: PhantomData<N>,
    item_data: PhantomData<T>,
    key_data: PhantomData<K>
}

impl<T: FadromaSerialize + FadromaDeserialize, N: Namespace, K: Key> ItemSpace<T, N, K> {
    #[inline]
    pub const fn new() -> Self {
        Self {
            namespace_data: PhantomData,
            item_data: PhantomData,
            key_data: PhantomData
        }
    }

    #[inline]
    pub fn save(
        &self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
        item: &T
    ) -> StdResult<()> {
        super::save(storage, Self::key(key), item)
    }

    #[inline]
    pub fn load(
        &self,
        storage: &dyn Storage,
        key: impl Into<K>,
    ) -> StdResult<Option<T>> {
        super::load(storage, Self::key(key))
    }

    #[inline]
    pub fn load_or_error(
        &self,
        storage: &dyn Storage,
        key: impl Into<K>,
    ) -> StdResult<T> {
        let result = self.load(storage, key)?;

        result.ok_or_else(|| not_found_error::<T>())
    }

    #[inline]
    pub fn remove(
        &self,
        storage: &mut dyn Storage,
        key: impl Into<K>,
    ) {
        super::remove(storage, Self::key(key))
    }

    #[inline]
    pub fn canonize_and_save<Input: Canonize<Output = T>>(
        &self,
        deps: DepsMut,
        key: impl Into<K>,
        item: Input
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;

        self.save(deps.storage, key, &item)
    }

    #[inline]
    fn key(key: impl Into<K>) -> Vec<u8> {
        let key = key.into();

        let mut buf = Vec::with_capacity(N::NAMESPACE.len() + key.size());
        buf.extend_from_slice(N::NAMESPACE);
        key.write_segments(&mut buf);

        buf
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Humanize,
    N: Namespace,
    K: Key
> ItemSpace<T, N, K> {
    #[inline]
    pub fn load_humanize(
        &self,
        deps: Deps,
        key: impl Into<K>
    ) -> StdResult<Option<<T as Humanize>::Output>> {
        let result: Option<T> = self.load(deps.storage, key)?;

        match result {
            Some(item) => Ok(Some(item.humanize(deps.api)?)),
            None => Ok(None)
        }
    }

    #[inline]
    pub fn load_humanize_or_error(
        &self,
        deps: Deps,
        key: impl Into<K>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanize(deps, key)?;

        result.ok_or_else(|| not_found_error::<T>())
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Humanize,
    N: Namespace,
    K: Key
> ItemSpace<T, N, K>
    where <T as Humanize>::Output: Default
{
    #[inline]
    pub fn load_humanize_or_default(
        &self,
        deps: Deps,
        key: impl Into<K>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanize(deps, key)?;

        Ok(result.unwrap_or_default())
    }
}

impl<
    T: FadromaSerialize + FadromaDeserialize + Default,
    N: Namespace,
    K: Key
> ItemSpace<T, N, K> {
    #[inline]
    pub fn load_or_default(
        &self,
        storage: &dyn Storage,
        key: impl Into<K>,
    ) -> StdResult<T> {
        let result: Option<T> = self.load(storage, key)?;

        Ok(result.unwrap_or_default())
    }
}

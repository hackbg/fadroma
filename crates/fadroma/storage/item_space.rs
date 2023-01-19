use std::marker::PhantomData;

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{
    core::{Humanize, Canonize},
    cosmwasm_std::{Deps, DepsMut, Storage, StdResult}
};
use super::{Key, Namespace, concat_ns, not_found_error};

pub struct ItemSpace<T: Serialize + DeserializeOwned, N: Namespace, K: Key> {
    namespace_data: PhantomData<N>,
    item_data: PhantomData<T>,
    key_data: PhantomData<K>
}

impl<T: Serialize + DeserializeOwned, N: Namespace, K: Key> ItemSpace<T, N, K> {
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
    fn key(key: impl Into<K>) -> Vec<u8> {
        let key = key.into();

        concat_ns(N::NAMESPACE, key.segments())
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace,
    K: Key
> ItemSpace<T, N, K> {
    #[inline]
    pub fn save_canonized(
        &self,
        deps: DepsMut,
        key: impl Into<K>,
        item: T
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;

        super::save(deps.storage, Self::key(key), &item)
    }

    #[inline]
    pub fn load_humanized(
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
    pub fn load_humanized_or_error(
        &self,
        deps: Deps,
        key: impl Into<K>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps, key)?;

        result.ok_or_else(|| not_found_error::<T>())
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned + Default,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace,
    K: Key
> ItemSpace<T, N, K> {
    #[inline]
    pub fn load_humanized_or_default(
        &self,
        deps: Deps,
        key: impl Into<K>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps, key)?;

        Ok(result.unwrap_or_default())
    }
}

impl<T: Serialize + DeserializeOwned + Default, N: Namespace, K: Key> ItemSpace<T, N, K> {
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

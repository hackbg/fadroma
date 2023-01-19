use std::{
    any,
    marker::PhantomData
};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{
    core::{Humanize, Canonize},
    cosmwasm_std::{Deps, DepsMut, Storage, StdResult, StdError}
};
use super::{Key, Namespace, StaticKey, CompositeKey};

pub struct Item<T: Serialize + DeserializeOwned, K: Key = StaticKey> {
    ns: &'static [u8],
    item_data: PhantomData<T>,
    key_data: PhantomData<K>
}

//============================================================================
// Common
//============================================================================

impl<T: Serialize + DeserializeOwned, K: Key> Item<T, K> {
    #[inline]
    pub fn namespace(&self) -> &'static [u8] {
        self.ns
    }

    #[inline]
    fn not_found_error() -> StdError {
        StdError::not_found(format!("Storage load: {}", any::type_name::<T>()))
    }
}

//============================================================================
// StaticKey
//============================================================================

impl<T: Serialize + DeserializeOwned> Item<T, StaticKey> {
    #[inline]
    pub const fn new(key: StaticKey) -> Self {
        Self {
            ns: key.0,
            item_data: PhantomData,
            key_data: PhantomData
        }
    }

    #[inline]
    pub fn save(
        &self,
        storage: &mut dyn Storage,
        item: &T
    ) -> StdResult<()> {
        super::save(storage, self.ns, item)
    }

    #[inline]
    pub fn load(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<Option<T>> {
        super::load(storage, self.ns)
    }

    #[inline]
    pub fn load_or_error(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<T> {
        let result: Option<T> = super::load(storage, self.ns)?;

        result.ok_or_else(|| Self::not_found_error())
    }

    #[inline]
    pub fn remove(
        &self,
        storage: &mut dyn Storage,
    ) {
        super::remove(storage, self.ns)
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>
> Item<T, StaticKey> {
    #[inline]
    pub fn save_canonized(
        &self,
        deps: DepsMut,
        item: T
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;

        super::save(deps.storage, self.ns, &item)
    }

    #[inline]
    pub fn load_humanized(
        &self,
        deps: Deps
    ) -> StdResult<Option<<T as Humanize>::Output>> {
        let result: Option<T> = super::load(deps.storage, self.ns)?;

        match result {
            Some(item) => Ok(Some(item.humanize(deps.api)?)),
            None => Ok(None)
        }
    }

    #[inline]
    pub fn load_humanized_or_error(
        &self,
        deps: Deps
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps)?;

        result.ok_or_else(|| Self::not_found_error())
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned + Default,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>
> Item<T, StaticKey> {
    #[inline]
    pub fn load_humanized_or_default(
        &self,
        deps: Deps,
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps)?;

        Ok(result.unwrap_or_default())
    }
}

impl<T: Serialize + DeserializeOwned + Default> Item<T, StaticKey> {
    #[inline]
    pub fn load_or_default(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<T> {
        let result: Option<T> = super::load(storage, self.ns)?;

        Ok(result.unwrap_or_default())
    }
}

//============================================================================
// CompositeKey
//============================================================================

impl<T: Serialize + DeserializeOwned, N: Namespace> Item<T, CompositeKey<N>> {
    #[inline]
    pub const fn new() -> Self {
        Self {
            ns: N::NAMESPACE,
            item_data: PhantomData,
            key_data: PhantomData
        }
    }

    #[inline]
    pub fn save(
        &self,
        storage: &mut dyn Storage,
        key: impl Into<CompositeKey<N>>,
        item: &T
    ) -> StdResult<()> {
        let key = key.into();

        super::save(storage, &key, item)
    }

    #[inline]
    pub fn load(
        &self,
        storage: &dyn Storage,
        key: impl Into<CompositeKey<N>>,
    ) -> StdResult<Option<T>> {
        let key = key.into();

        super::load(storage, &key)
    }

    #[inline]
    pub fn load_or_error(
        &self,
        storage: &dyn Storage,
        key: impl Into<CompositeKey<N>>,
    ) -> StdResult<T> {
        let key = key.into();
        let result = super::load(storage, &key)?;

        result.ok_or_else(|| Self::not_found_error())
    }

    #[inline]
    pub fn remove(
        &self,
        storage: &mut dyn Storage,
        key: impl Into<CompositeKey<N>>,
    ) {
        let key = key.into();

        super::remove(storage, &key)
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace
> Item<T, CompositeKey<N>> {
    #[inline]
    pub fn save_canonized(
        &self,
        deps: DepsMut,
        key: impl Into<CompositeKey<N>>,
        item: T
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;
        let key = key.into();

        super::save(deps.storage, &key, &item)
    }

    #[inline]
    pub fn load_humanized(
        &self,
        deps: Deps,
        key: impl Into<CompositeKey<N>>
    ) -> StdResult<Option<<T as Humanize>::Output>> {
        let key = key.into();
        let result: Option<T> = super::load(deps.storage, &key)?;

        match result {
            Some(item) => Ok(Some(item.humanize(deps.api)?)),
            None => Ok(None)
        }
    }

    #[inline]
    pub fn load_humanized_or_error(
        &self,
        deps: Deps,
        key: impl Into<CompositeKey<N>>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps, key)?;

        result.ok_or_else(|| Self::not_found_error())
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned + Default,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace
> Item<T, CompositeKey<N>> {
    #[inline]
    pub fn load_humanized_or_default(
        &self,
        deps: Deps,
        key: impl Into<CompositeKey<N>>
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps, key)?;

        Ok(result.unwrap_or_default())
    }
}

impl<T: Serialize + DeserializeOwned + Default, N: Namespace> Item<T, CompositeKey<N>> {
    #[inline]
    pub fn load_or_default(
        &self,
        storage: &dyn Storage,
        key: impl Into<CompositeKey<N>>,
    ) -> StdResult<T> {
        let key = key.into();
        let result: Option<T> = super::load(storage, &key)?;

        Ok(result.unwrap_or_default())
    }
}

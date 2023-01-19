use std::marker::PhantomData;

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{
    core::{Humanize, Canonize},
    cosmwasm_std::{Deps, DepsMut, Storage, StdResult}
};
use super::{Namespace, not_found_error};

pub struct SingleItem<T: Serialize + DeserializeOwned, N: Namespace> {
    namespace_data: PhantomData<N>,
    item_data: PhantomData<T>
}

impl<T: Serialize + DeserializeOwned, N: Namespace> SingleItem<T, N> {
    #[inline]
    pub const fn new() -> Self {
        Self {
            namespace_data: PhantomData,
            item_data: PhantomData
        }
    }

    #[inline]
    pub fn namespace(&self) -> &'static [u8] {
        N::NAMESPACE
    }

    #[inline]
    pub fn save(
        &self,
        storage: &mut dyn Storage,
        item: &T
    ) -> StdResult<()> {
        super::save(storage, N::NAMESPACE, item)
    }

    #[inline]
    pub fn load(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<Option<T>> {
        super::load(storage, N::NAMESPACE)
    }

    #[inline]
    pub fn load_or_error(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<T> {
        let result: Option<T> = super::load(storage, N::NAMESPACE)?;

        result.ok_or_else(|| not_found_error::<T>())
    }

    #[inline]
    pub fn remove(
        &self,
        storage: &mut dyn Storage,
    ) {
        super::remove(storage, N::NAMESPACE)
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace
> SingleItem<T, N> {
    #[inline]
    pub fn save_canonized(
        &self,
        deps: DepsMut,
        item: T
    ) -> StdResult<()> {
        let item = item.canonize(deps.api)?;

        super::save(deps.storage, N::NAMESPACE, &item)
    }

    #[inline]
    pub fn load_humanized(
        &self,
        deps: Deps
    ) -> StdResult<Option<<T as Humanize>::Output>> {
        let result: Option<T> = super::load(deps.storage, N::NAMESPACE)?;

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

        result.ok_or_else(|| not_found_error::<T>())
    }
}

impl<
    C: Serialize,
    H: DeserializeOwned + Default,
    T: Serialize + DeserializeOwned + Humanize<Output = H> + Canonize<Output = C>,
    N: Namespace
> SingleItem<T, N> {
    #[inline]
    pub fn load_humanized_or_default(
        &self,
        deps: Deps,
    ) -> StdResult<<T as Humanize>::Output> {
        let result = self.load_humanized(deps)?;

        Ok(result.unwrap_or_default())
    }
}

impl<T: Serialize + DeserializeOwned + Default, N: Namespace> SingleItem<T, N> {
    #[inline]
    pub fn load_or_default(
        &self,
        storage: &dyn Storage,
    ) -> StdResult<T> {
        let result: Option<T> = super::load(storage, N::NAMESPACE)?;

        Ok(result.unwrap_or_default())
    }
}

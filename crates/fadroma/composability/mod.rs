//! Modular contracts using native trait composition.
//! *Feature flag: `composability`*

#[cfg(not(target_arch = "wasm32"))]
pub mod tester;
mod namespace;

use serde::{de::DeserializeOwned, Serialize};
use namespace::{key_prefix, key_prefix_nested};

use crate::{
    prelude::*,
    storage::{load, save, remove, concat}
};

pub trait Composable:
    StorageWrapper + MutableStorageWrapper + ApiWrapper + QuerierWrap {}

pub trait StorageWrapper {
    fn storage(&self) -> &dyn Storage;

    #[inline]
    fn get<Value: DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value> {
        load(self.storage(), key)
    }

    #[inline]
    fn get_ns<Value: DeserializeOwned>(&self, ns: &[u8], key: &[u8])
        -> Eventually<Value>
    {
        let ns = key_prefix(ns);
        self.get(&concat(&ns, key))
    }

    #[inline]
    fn get_multi_ns<Value: DeserializeOwned>(&self, ns: &[&[u8]], key: &[u8])
        -> Eventually<Value>
    {
        let ns = key_prefix_nested(ns);
        self.get(&concat(&ns, key))
    }
}

pub trait MutableStorageWrapper {
    fn storage_mut(&mut self) -> &mut dyn Storage;

    #[inline]
    fn set<Value: Serialize>(
        &mut self, key: &[u8], value: &Value
    ) -> UsuallyOk {
        save(self.storage_mut(), key, value)
    }

    /// Uses a single slice as namespace and it combines it with the key
    #[inline]
    fn set_ns<Value: Serialize>(
        &mut self, ns: &[u8], key: &[u8], value: &Value,
    ) -> UsuallyOk {
        let ns = key_prefix(ns);
        self.set(&concat(&ns, key), value)
    }

    /// Uses an array of slices which are then combined according to the following spec:
    /// https://github.com/webmaster128/key-namespacing#nesting
    #[inline]
    fn set_multi_ns<Value: Serialize>(
        &mut self, ns: &[&[u8]], key: &[u8], value: &Value,
    ) -> UsuallyOk {
        let ns = key_prefix_nested(ns);
        self.set(&concat(&ns, key), value)
    }

    #[inline]
    fn remove(&mut self, key: &[u8]) {
        remove(self.storage_mut(), key);
    }

    #[inline]
    fn remove_ns(&mut self, ns: &[u8], key: &[u8]) {
        let ns = key_prefix(ns);
        self.remove(&concat(&ns, key));
    }

    #[inline]
    fn remove_multi_ns(&mut self, ns: &[&[u8]], key: &[u8]) {
        let ns = key_prefix_nested(ns);
        self.remove(&concat(&ns, key));
    }
}

pub trait ApiWrapper {
    fn api(&self) -> &dyn Api;

    #[inline]
    fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output> {
        value.humanize(self.api())
    }
    #[inline]
    fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output> {
        value.canonize(self.api())
    }
}

pub trait QuerierWrap {
    fn querier(&self) -> &QuerierWrapper<'_>;
}

/// Implement the Composable Core for a `struct { storage, api, querier }`
#[macro_export]
macro_rules! make_composable {
    ($Struct:ty) => {
        impl StorageWrapper for $Struct {
            #[inline]
            fn storage(&self) -> &dyn Storage {
                self.storage
            }
        }

        impl MutableStorageWrapper for $Struct {
            #[inline]
            fn storage_mut(&mut self) -> &mut dyn Storage {
                self.storage
            }
        }

        impl ApiWrapper for $Struct {
            #[inline] 
            fn api(&self) -> &dyn Api {
                self.api
            }
        }

        impl QuerierWrap for $Struct {
            #[inline]
            fn querier(&self) -> &QuerierWrapper<'_> {
                &self.querier
            }
        }

        impl Composable for $Struct {}
    };
}

make_composable!(DepsMut<'_>);
//make_composable!(Deps<'_>);

/// Trait for handle messages
pub trait HandleDispatch<C> where
    C: Composable
{
    fn dispatch_handle (self, core: &mut C, env: Env) -> StdResult<Response>;
}

/// Trait for query messages
pub trait QueryDispatch<C, R> where
    C: Composable
{
    fn dispatch_query (self, core: &C) -> StdResult<R>;
}

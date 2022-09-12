//! *Feature flag: `composability`*
//! Modular contracts using native trait composition.

use serde::{de::DeserializeOwned, Serialize};
use crate::{
    prelude::*,
    storage::{load, save, remove, concat, namespace::{key_prefix, key_prefix_nested}}
};

#[cfg(not(target_arch = "wasm32"))] pub mod tester;
#[cfg(not(target_arch = "wasm32"))] pub use tester::*;

pub trait Composable<S: Storage, A: Api, Q: Querier>:
    StorageWrapper<S> + MutableStorageWrapper<S> + ApiWrapper<A> + QuerierWrapper<Q> {}

pub trait StorageWrapper<S: Storage> {
    fn storage(&self) -> &S;

    #[inline] fn get<Value: DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value> {
        load(self.storage(), key)
    }
    #[inline] fn get_ns<Value: DeserializeOwned>(&self, ns: &[u8], key: &[u8])
        -> Eventually<Value>
    {
        let ns = key_prefix(ns);
        self.get(&concat(&ns, key))
    }
    #[inline] fn get_multi_ns<Value: DeserializeOwned>(&self, ns: &[&[u8]], key: &[u8])
        -> Eventually<Value>
    {
        let ns = key_prefix_nested(ns);
        self.get(&concat(&ns, key))
    }
}

pub trait MutableStorageWrapper<S: Storage> {
    fn storage_mut(&mut self) -> &mut S;

    #[inline] fn set<Value: Serialize>(
        &mut self, key: &[u8], value: &Value
    ) -> UsuallyOk {
        save(self.storage_mut(), key, value)
    }
    /// Uses a single slice as namespace and it combines it with the key
    #[inline] fn set_ns<Value: Serialize>(
        &mut self, ns: &[u8], key: &[u8], value: &Value,
    ) -> UsuallyOk {
        let ns = key_prefix(ns);
        self.set(&concat(&ns, key), value)
    }
    /// Uses an array of slices which are then combined according to the following spec:
    /// https://github.com/webmaster128/key-namespacing#nesting
    #[inline] fn set_multi_ns<Value: Serialize>(
        &mut self, ns: &[&[u8]], key: &[u8], value: &Value,
    ) -> UsuallyOk {
        let ns = key_prefix_nested(ns);
        self.set(&concat(&ns, key), value)
    }

    #[inline] fn remove(&mut self, key: &[u8]) {
        remove(self.storage_mut(), key);
    }
    #[inline] fn remove_ns(&mut self, ns: &[u8], key: &[u8]) {
        let ns = key_prefix(ns);
        self.remove(&concat(&ns, key));
    }
    #[inline] fn remove_multi_ns(&mut self, ns: &[&[u8]], key: &[u8]) {
        let ns = key_prefix_nested(ns);
        self.remove(&concat(&ns, key));
    }
}

pub trait ApiWrapper<A: Api> {
    fn api(&self) -> &A;

    #[inline] fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output> {
        value.humanize(self.api())
    }
    #[inline] fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output> {
        value.canonize(self.api())
    }
}

pub trait QuerierWrapper<Q: Querier> {
    fn querier(&self) -> &Q;
}

/// Implement the Composable Core for a `struct { storage, api, querier }`
#[macro_export]
macro_rules! make_composable {
    ($Struct:ty) => {
        impl<S: Storage, A: Api, Q: Querier> StorageWrapper<S> for $Struct {
            #[inline] fn storage(&self) -> &S { &self.storage }
        }
        impl<S: Storage, A: Api, Q: Querier> MutableStorageWrapper<S> for $Struct {
            #[inline] fn storage_mut(&mut self) -> &mut S { &mut self.storage }
        }
        impl <S: Storage, A: Api, Q: Querier> ApiWrapper<A> for $Struct {
            #[inline] fn api(&self) -> &A { &self.api }
        }
        impl <S: Storage, A: Api, Q: Querier> QuerierWrapper<Q> for $Struct {
            #[inline] fn querier(&self) -> &Q { &self.querier }
        }
        impl <S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for $Struct {}
    };
}

make_composable!(Extern<S, A, Q>);

/// Trait for handle messages
pub trait HandleDispatch <S, A, Q, C> where
    S: Storage,
    A: Api,
    Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_handle (self, core: &mut C, env: Env) -> StdResult<HandleResponse>;
}

/// Trait for query messages
pub trait QueryDispatch <S, A, Q, C, R> where
    S: Storage,
    A: Api,
    Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<R>;
}

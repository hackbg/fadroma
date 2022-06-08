//! TODO:
//!
//! * Declare a local struct wrapping the foreign `Extern` from cosmwasm_std
//!   so that feature traits from Fadroma (also foreign) can be plugged in
//!
//! * Maybe the simplest approach would be to implement Storage, Api and Querier on Extern
//!   directly. However this introduces a clash between `Storage::get/set` and
//!   `Composable::get/set`, therefor the latter will need to be renamed once again

use crate::namespace_helpers::{key_prefix, key_prefix_nested};
use fadroma_platform_scrt::{
    cosmwasm_std::{
        Extern, Storage, Api, Querier, StdResult, to_vec, from_slice
    },
    Humanize, Canonize
};
use fadroma_storage::*;
use serde::{de::DeserializeOwned, Serialize};

pub type UsuallyOk = StdResult<()>;

pub type Eventually<Value> = StdResult<Option<Value>>;

pub trait BaseComposable<S, A, Q> {
    fn storage(&self) -> &S;
    fn storage_mut(&mut self) -> &mut S;
    fn api(&self) -> &A;
    fn querier(&self) -> &Q;
}

pub trait Composable<S, A, Q>: BaseComposable<S, A, Q> {
    fn set<Value: Serialize>(&mut self, key: &[u8], value: Value) -> UsuallyOk;
    /// Uses a single slice as namespace and it combines it with the key
    fn set_ns<Value: Serialize>(&mut self, ns: &[u8], key: &[u8], value: Value) -> UsuallyOk;
    /// Uses an array of slices which are then combined according to the following spec:
    /// https://github.com/webmaster128/key-namespacing#nesting
    fn set_multi_ns<Value: Serialize>(
        &mut self,
        ns: &[&[u8]],
        key: &[u8],
        value: Value,
    ) -> UsuallyOk;

    fn get<Value: DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value>;
    fn get_ns<Value: DeserializeOwned>(&self, ns: &[u8], key: &[u8]) -> Eventually<Value>;
    fn get_multi_ns<Value: DeserializeOwned>(&self, ns: &[&[u8]], key: &[u8]) -> Eventually<Value>;

    fn remove(&mut self, key: &[u8]) -> UsuallyOk;
    fn remove_ns(&mut self, ns: &[u8], key: &[u8]) -> UsuallyOk;
    fn remove_multi_ns(&mut self, ns: &[&[u8]], key: &[u8]) -> UsuallyOk;

    fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output>;
    fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output>;
}

#[macro_export]
macro_rules! make_composable {
    ($Struct:ty) => {
        // base trait with no generic methods, in order to to support `dyn`
        impl<S: Storage, A: Api, Q: Querier> BaseComposable<S, A, Q> for $Struct {
            fn storage(&self) -> &S {
                &self.storage
            }
            fn storage_mut(&mut self) -> &mut S {
                &mut self.storage
            }
            fn api(&self) -> &A {
                &self.api
            }
            fn querier(&self) -> &Q {
                &self.querier
            }
        }

        impl<S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for $Struct {
            fn set<Value: serde::Serialize>(&mut self, key: &[u8], value: Value) -> UsuallyOk {
                self.storage.set(key, &to_vec(&Some(value))?);
                Ok(())
            }

            fn set_ns<Value: serde::Serialize>(
                &mut self,
                ns: &[u8],
                key: &[u8],
                value: Value,
            ) -> UsuallyOk {
                let ns = key_prefix(ns);
                self.set(&concat(&ns, key), value)
            }
            fn set_multi_ns<Value: serde::Serialize>(
                &mut self,
                ns: &[&[u8]],
                key: &[u8],
                value: Value,
            ) -> UsuallyOk {
                let ns = key_prefix_nested(ns);
                self.set(&concat(&ns, key), value)
            }

            fn get<Value: serde::de::DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value> {
                if let Some(data) = self.storage.get(key) {
                    Ok(from_slice(&data)?)
                } else {
                    Ok(None)
                    //Err(StdError::generic_err(format!("{:?}: not found in storage", &key)))
                }
            }

            fn get_ns<Value: serde::de::DeserializeOwned>(
                &self,
                ns: &[u8],
                key: &[u8],
            ) -> Eventually<Value> {
                let ns = key_prefix(ns);
                self.get(&concat(&ns, key))
            }
            fn get_multi_ns<Value: serde::de::DeserializeOwned>(
                &self,
                ns: &[&[u8]],
                key: &[u8],
            ) -> Eventually<Value> {
                let ns = key_prefix_nested(ns);
                self.get(&concat(&ns, key))
            }

            fn remove(&mut self, key: &[u8]) -> UsuallyOk {
                self.storage.remove(key);
                Ok(())
            }
            fn remove_ns(&mut self, ns: &[u8], key: &[u8]) -> UsuallyOk {
                let ns = key_prefix(ns);
                self.remove(&concat(&ns, key))
            }
            fn remove_multi_ns(&mut self, ns: &[&[u8]], key: &[u8]) -> UsuallyOk {
                let ns = key_prefix_nested(ns);
                self.remove(&concat(&ns, key))
            }

            fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output> {
                value.humanize(&self.api)
            }

            fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output> {
                value.canonize(&self.api)
            }
        }
    };
}

make_composable!(Extern<S, A, Q>);

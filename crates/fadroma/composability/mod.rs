//! *Feature flag: `composability`*
//! Modular contracts using native trait composition.

use serde::{de::DeserializeOwned, Serialize};
use crate::{prelude::*, storage::{concat, namespace::{key_prefix, key_prefix_nested}}};

#[cfg(not(target_arch = "wasm32"))]
pub mod tester;
#[cfg(not(target_arch = "wasm32"))]
pub use tester::*;

pub trait BaseComposable<S, A, Q> {
    fn storage(&self) -> &S;
    fn storage_mut(&mut self) -> &mut S;
    fn api(&self) -> &A;
    fn querier(&self) -> &Q;
}

pub trait Composable<S, A, Q>: BaseComposable<S, A, Q> {
    fn set<Value: Serialize>(&mut self, key: &[u8], value: &Value) -> UsuallyOk;
    /// Uses a single slice as namespace and it combines it with the key
    fn set_ns<Value: Serialize>(&mut self, ns: &[u8], key: &[u8], value: &Value) -> UsuallyOk;
    /// Uses an array of slices which are then combined according to the following spec:
    /// https://github.com/webmaster128/key-namespacing#nesting
    fn set_multi_ns<Value: Serialize>(
        &mut self,
        ns: &[&[u8]],
        key: &[u8],
        value: &Value,
    ) -> UsuallyOk;

    fn get<Value: DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value>;
    fn get_ns<Value: DeserializeOwned>(&self, ns: &[u8], key: &[u8]) -> Eventually<Value>;
    fn get_multi_ns<Value: DeserializeOwned>(&self, ns: &[&[u8]], key: &[u8]) -> Eventually<Value>;

    fn remove(&mut self, key: &[u8]);
    fn remove_ns(&mut self, ns: &[u8], key: &[u8]);
    fn remove_multi_ns(&mut self, ns: &[&[u8]], key: &[u8]);

    fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output>;
    fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output>;
}

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

/// Implement the Composable Core for a `struct { storage, api, querier }`
#[macro_export]
macro_rules! make_composable {
    ($Struct:ty) => {
        // base trait with no generic methods, in order to to support `dyn`
        impl<S: Storage, A: Api, Q: Querier> BaseComposable<S, A, Q> for $Struct {
            #[inline]
            fn storage(&self) -> &S {
                &self.storage
            }

            #[inline]
            fn storage_mut(&mut self) -> &mut S {
                &mut self.storage
            }

            #[inline]
            fn api(&self) -> &A {
                &self.api
            }

            #[inline]
            fn querier(&self) -> &Q {
                &self.querier
            }
        }

        impl<S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for $Struct {
            #[inline]
            fn set<Value: serde::Serialize>(&mut self, key: &[u8], value: &Value) -> UsuallyOk {
                self.storage.set(key, &to_vec(value)?);
                Ok(())
            }

            #[inline]
            fn set_ns<Value: serde::Serialize>(
                &mut self,
                ns: &[u8],
                key: &[u8],
                value: &Value,
            ) -> UsuallyOk {
                let ns = key_prefix(ns);
                self.set(&concat(&ns, key), value)
            }

            #[inline]
            fn set_multi_ns<Value: serde::Serialize>(
                &mut self,
                ns: &[&[u8]],
                key: &[u8],
                value: &Value,
            ) -> UsuallyOk {
                let ns = key_prefix_nested(ns);
                self.set(&concat(&ns, key), value)
            }

            #[inline]
            fn get<Value: serde::de::DeserializeOwned>(&self, key: &[u8]) -> Eventually<Value> {
                match self.storage.get(key) {
                    Some(data) => Ok(Some(from_slice(&data)?)),
                    None => Ok(None)
                }
            }

            #[inline]
            fn get_ns<Value: serde::de::DeserializeOwned>(
                &self,
                ns: &[u8],
                key: &[u8],
            ) -> Eventually<Value> {
                let ns = key_prefix(ns);
                self.get(&concat(&ns, key))
            }

            #[inline]
            fn get_multi_ns<Value: serde::de::DeserializeOwned>(
                &self,
                ns: &[&[u8]],
                key: &[u8],
            ) -> Eventually<Value> {
                let ns = key_prefix_nested(ns);
                self.get(&concat(&ns, key))
            }

            #[inline]
            fn remove(&mut self, key: &[u8]) {
                self.storage.remove(key);
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

            #[inline]
            fn humanize<Value: Humanize>(&self, value: Value) -> StdResult<Value::Output> {
                value.humanize(&self.api)
            }

            #[inline]
            fn canonize<Value: Canonize>(&self, value: Value) -> StdResult<Value::Output> {
                value.canonize(&self.api)
            }
        }
    };
}

make_composable!(Extern<S, A, Q>);

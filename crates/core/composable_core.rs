//! TODO:
//!
//! * Declare a local struct wrapping the foreign `Extern` from cosmwasm_std
//!   so that feature traits from Fadroma (also foreign) can be plugged in
//!
//! * Maybe the simplest approach would be to implement Storage, Api and Querier on Extern
//!   directly. However this introduces a clash between `Storage::get/set` and
//!   `Composable::get/set`, therefor the latter will need to be renamed once again

use crate::{
    scrt::{Extern, Storage, Api, Querier, StdResult, to_vec, from_slice},
    scrt_addr::{Humanize, Canonize},
    scrt_storage::concat
};

use serde::{Serialize, de::DeserializeOwned};

pub type UsuallyOk = StdResult<()>;

pub type Eventually<Value> = StdResult<Option<Value>>;

pub trait BaseComposable<S, A, Q> {
    fn storage     (&self)     -> &S;
    fn storage_mut (&mut self) -> &mut S;
    fn api         (&self)     -> &A;
    fn querier     (&self)     -> &Q;
}

pub trait Composable<S, A, Q>: BaseComposable<S, A, Q> {
    fn set    <Value: Serialize> (&mut self, key: &[u8], value: Value) -> UsuallyOk;
    fn set_ns <Value: Serialize> (&mut self, ns: &[u8], key: &[u8], value: Value) -> UsuallyOk;

    fn get    <Value: DeserializeOwned> (&self, key: &[u8]) -> Eventually<Value>;
    fn get_ns <Value: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> Eventually<Value>;

    fn humanize <Value: Humanize<U>, U: Canonize<Value>> (&self, value: Value) -> StdResult<U>;
    fn canonize <Value: Canonize<U>, U: Humanize<Value>> (&self, value: Value) -> StdResult<U>;
}

#[macro_export] macro_rules! make_composable {
    ($Struct:ty) => {
        // base trait with no generic methods to support `dyn`
        impl<S: Storage, A: Api, Q: Querier> BaseComposable<S, A, Q> for $Struct {
            fn storage     (&self)     -> &S { &self.storage }
            fn storage_mut (&mut self) -> &mut S { &mut self.storage }
            fn api         (&self)     -> &A { &self.api }
            fn querier     (&self)     -> &Q { &self.querier }
        }
        impl<S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for $Struct {
            fn set <Value: serde::Serialize> (&mut self, key: &[u8], value: Value) -> UsuallyOk {
                self.storage.set(key, &to_vec(&Some(value))?);
                Ok(())
            }
            fn set_ns <Value: serde::Serialize> (&mut self, ns: &[u8], key: &[u8], value: Value) -> UsuallyOk {
                self.set(&concat(ns, key), value)
            }
            fn get <Value: serde::de::DeserializeOwned> (&self, key: &[u8]) -> Eventually<Value> {
                if let Some(data) = self.storage.get(key) {
                    Ok(from_slice(&data)?)
                } else {
                    Ok(None)
                    //Err(StdError::generic_err(format!("{:?}: not found in storage", &key)))
                }
            }
            fn get_ns <Value: serde::de::DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> Eventually<Value> {
                self.get(&concat(ns, key))
            }
            fn humanize <Value: Humanize<U>, U: Canonize<Value>> (&self, value: Value) -> StdResult<U> {
                value.humanize(&self.api)
            }
            fn canonize <Value: Canonize<U>, U: Humanize<Value>> (&self, value: Value) -> StdResult<U> {
                value.canonize(&self.api)
            }
        }
    }
}

make_composable!(Extern<S, A, Q>);

use crate::scrt::{Extern, Storage, Api, Querier, StdResult, StdError, to_vec, from_slice};
use crate::scrt_addr::{Humanize, Canonize};
use crate::scrt_storage::concat;
use serde::{Serialize, de::DeserializeOwned};

pub trait Composable<S, A, Q> {
    fn storage (self) -> S;
    fn set <V: Serialize> (&mut self, key: &[u8], value: V)
        -> StdResult<()>;
    fn set_ns <V: Serialize> (&mut self, ns: &[u8], key: &[u8], value: V)
        -> StdResult<()>;
    fn get <V: DeserializeOwned> (&self, key: &[u8])
        -> StdResult<V>;
    fn get_ns <V: DeserializeOwned> (&self, ns: &[u8], key: &[u8])
        -> StdResult<V>;

    fn api (self) -> A;
    fn humanize <V: Humanize<U>, U: Canonize<V>> (&self, value: V) ->
        StdResult<U>;
    fn canonize <V: Canonize<U>, U: Humanize<V>> (&self, value: V)
        -> StdResult<U>;

    fn querier (self) -> Q;
}

impl<S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for Extern<S, A, Q> {

    fn storage (self) -> S {
        self.storage
    }
    fn set <V: Serialize> (&mut self, key: &[u8], value: V) -> StdResult<()> {
        self.storage.set(key, &to_vec(&value)?);
        Ok(())
    }
    fn set_ns <V: Serialize> (&mut self, ns: &[u8], key: &[u8], value: V) -> StdResult<()> {
        self.set(&concat(ns, key), value)
    }
    fn get <V: DeserializeOwned> (&self, key: &[u8]) -> StdResult<V> {
        if let Some(data) = self.storage.get(key) {
            Ok(from_slice(&data)?)
        } else {
            Err(StdError::generic_err(format!("{:?}: not found in storage", &key)))
        }
    }
    fn get_ns <V: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> StdResult<V> {
        self.get(&concat(ns, key))
    }

    fn api (self) -> A {
        self.api
    }
    fn humanize <V: Humanize<U>, U: Canonize<V>> (&self, value: V) -> StdResult<U> {
        value.humanize(&self.api)
    }
    fn canonize <V: Canonize<U>, U: Humanize<V>> (&self, value: V) -> StdResult<U> {
        value.canonize(&self.api)
    }

    fn querier (self) -> Q {
        self.querier
    }

}

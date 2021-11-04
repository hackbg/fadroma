use crate::*;
use serde::{Serialize, de::DeserializeOwned};

pub trait BaseComposable<S, A, Q> {
    fn storage     (&self)     -> &S;
    fn storage_mut (&mut self) -> &mut S;
    fn api         (&self)     -> &A;
    fn querier     (&self)     -> &Q;
}

impl<S: Storage, A: Api, Q: Querier> BaseComposable<S, A, Q> for Extern<S, A, Q> {
    fn storage (&self) -> &S {
        &self.storage
    }
    fn storage_mut (&mut self) -> &mut S {
        &mut self.storage
    }
    fn api (&self) -> &A {
        &self.api
    }
    fn querier (&self) -> &Q {
        &self.querier
    }
}

pub type UsuallyOk = StdResult<()>;

pub type Eventually<Value> = StdResult<Option<Value>>;

pub trait Composable<S, A, Q>: BaseComposable<S, A, Q> {
    fn set    <Value: Serialize> (&mut self, key: &[u8], value: Value) -> UsuallyOk;
    fn set_ns <Value: Serialize> (&mut self, ns: &[u8], key: &[u8], value: Value) -> UsuallyOk;

    fn get    <Value: DeserializeOwned> (&self, key: &[u8]) -> Eventually<Value>;
    fn get_ns <Value: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> Eventually<Value>;

    fn humanize <Value: Humanize<U>, U: Canonize<Value>> (&self, value: Value) -> StdResult<U>;
    fn canonize <Value: Canonize<U>, U: Humanize<Value>> (&self, value: Value) -> StdResult<U>;
}

impl<S: Storage, A: Api, Q: Querier> Composable<S, A, Q> for Extern<S, A, Q> {
    fn set <Value: Serialize> (&mut self, key: &[u8], value: Value) -> UsuallyOk {
        self.storage.set(key, &to_vec(&Some(value))?);
        Ok(())
    }
    fn set_ns <Value: Serialize> (&mut self, ns: &[u8], key: &[u8], value: Value) -> UsuallyOk {
        self.set(&concat(ns, key), value)
    }
    fn get <Value: DeserializeOwned> (&self, key: &[u8]) -> Eventually<Value> {
        if let Some(data) = self.storage.get(key) {
            Ok(from_slice(&data)?)
        } else {
            Ok(None)
            //Err(StdError::generic_err(format!("{:?}: not found in storage", &key)))
        }
    }
    fn get_ns <Value: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> Eventually<Value> {
        self.get(&concat(ns, key))
    }
    fn humanize <Value: Humanize<U>, U: Canonize<Value>> (&self, value: Value) -> StdResult<U> {
        value.humanize(&self.api)
    }
    fn canonize <Value: Canonize<U>, U: Humanize<Value>> (&self, value: Value) -> StdResult<U> {
        value.canonize(&self.api)
    }
}

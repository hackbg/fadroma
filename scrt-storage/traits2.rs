pub use serde::{Serialize, de::DeserializeOwned};
pub use fadroma_scrt_base::cosmwasm_std::{
    Storage, ReadonlyStorage, StdResult,
    to_vec, from_slice
};

use crate::concat;

pub trait Readonly <S: ReadonlyStorage> {
    fn storage (&self) -> &S;
    fn load <T: DeserializeOwned> (&self, key: &[u8]) -> StdResult<Option<T>> {
        match self.storage().get(key) {
            Some(data) => from_slice(&data),
            None => Ok(None)
        }
    }
    fn load_ns <T: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> StdResult<Option<T>> {
        self.load(&concat(ns, key))
    }
}

pub trait Writable <S: Storage>: Readonly<S> {
    fn storage_mut (&mut self) -> &mut S;
    fn save <T: Serialize> (&mut self, key: &[u8], val: T) -> StdResult<&mut Self> {
        self.storage_mut().set(&key, &to_vec(&val)?);
        Ok(self)
    }
    fn save_ns <T: Serialize> (&mut self, ns: &[u8], key: &[u8], val: T) -> StdResult<&mut Self> {
        self.save(&concat(ns, key), val)
    }
}

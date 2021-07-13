mod traits; pub use traits::Storable;
use serde::Serialize;
use serde::de::DeserializeOwned;
pub use fadroma_scrt_base::cosmwasm_std::{ReadonlyStorage, StdResult, Storage, from_slice, to_vec};

#[inline]
pub fn save <T: Serialize, S: Storage> (
    storage: &mut S,
    key:     &[u8],
    value:   &T
) -> StdResult<()> {
    storage.set(key, &to_vec(value)?);
    Ok(())
}

#[inline]
pub fn remove <S: Storage> (
    storage: &mut S,
    key:     &[u8]
) {
    storage.remove(key);
}

#[inline]
pub fn load <T: DeserializeOwned, S: ReadonlyStorage> (
    storage: &S,
    key:     &[u8]
) -> StdResult<Option<T>> {
    match storage.get(key) {
        Some(data) => from_slice(&data),
        None => Ok(None)
    }
}

#[inline]
pub fn ns_save <T: Serialize, S: Storage> (
    storage:   &mut S,
    namespace: &[u8],
    key:       &[u8],
    value:     &T
) -> StdResult<()> {
    storage.set(&concat(namespace, key), &to_vec(value)?);
    Ok(())
}

#[inline]
pub fn ns_remove <S: Storage> (
    storage:   &mut S,
    namespace: &[u8],
    key:       &[u8]
) {
    let key = concat(namespace, key);
    storage.remove(&key);
}

#[inline]
pub fn ns_load <T: DeserializeOwned, S: ReadonlyStorage> (
    storage:   &S,
    namespace: &[u8],
    key:       &[u8]
) -> StdResult<Option<T>> {
    load(storage, &concat(namespace, key))
}

#[inline]
pub fn concat(
    namespace: &[u8],
    key:       &[u8]
) -> Vec<u8> {
    let mut k = namespace.to_vec();
    k.extend_from_slice(key);
    k
}

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

//#[macro_export] macro_rules! load {
    //($self:ident, $key:expr) => {
        //fadroma::scrt::storage::load(&$self.0, $key)
    //};
//}

//#[macro_export] macro_rules! save {
    //($self:ident, $key:expr, $val:expr) => {
        //$self.0.as_mut().set(&$key, &to_vec(&$val)?);
    //};
//}

//#[macro_export] macro_rules! ns_load {
    //($self:ident, $ns:expr, $key:expr) => {
        //fadroma::scrt::storage::ns_load(&$self.0, $ns, $key.as_slice())
    //};
//}

//#[macro_export] macro_rules! ns_save {
    //($self:ident, $ns:expr, $key:expr, $val:expr) => {
        //$self.0.as_mut().set(&concat($ns, $key.as_slice()), &to_vec(&$val)?)
    //}
//}

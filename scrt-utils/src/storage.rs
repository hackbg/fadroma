use serde::Serialize;
use serde::de::DeserializeOwned;
use cosmwasm_std::{ReadonlyStorage, StdResult, Storage, from_slice, to_vec};

pub fn save<T: Serialize, S: Storage>(storage: &mut S, key: &[u8], value: &T) -> StdResult<()> {
    storage.set(key, &to_vec(value)?);
    Ok(())
}

pub fn remove<S: Storage>(storage: &mut S, key: &[u8]) {
    storage.remove(key);
}

pub fn load<T: DeserializeOwned, S: ReadonlyStorage>(storage: &S, key: &[u8]) -> StdResult<Option<T>> {
    let result = storage.get(key);

    if let Some(data) = result {
        from_slice(&data)
    } else {
        Ok(None)
    }
}

pub fn ns_save<T: Serialize, S: Storage>(storage: &mut S, namespace: &[u8], key: &[u8], value: &T) -> StdResult<()> {
    let key = concat(namespace, key);
    storage.set(&key, &to_vec(value)?);

    Ok(())
}

pub fn ns_remove<S: Storage>(storage: &mut S, namespace: &[u8], key: &[u8]) {
    let key = concat(namespace, key);
    storage.remove(&key);
}

pub fn ns_load<T: DeserializeOwned, S: ReadonlyStorage>(storage: &S, namespace: &[u8], key: &[u8]) -> StdResult<Option<T>> {
    let key = concat(namespace, key);

    load(storage, &key)
}

#[inline]
fn concat(namespace: &[u8], key: &[u8]) -> Vec<u8> {
    let mut k = namespace.to_vec();
    k.extend_from_slice(key);

    k
}

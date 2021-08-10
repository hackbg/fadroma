use serde::Serialize;
use serde::de::DeserializeOwned;
pub use crate::{scrt::{ReadonlyStorage, StdResult, Storage, from_slice, to_vec}};

/// Save something to the storage.
#[inline]
pub fn save <T: Serialize, S: Storage> (
    storage: &mut S,
    key:     &[u8],
    value:   &T
) -> StdResult<()> {
    storage.set(key, &to_vec(value)?);
    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove <S: Storage> (
    storage: &mut S,
    key:     &[u8]
) {
    storage.remove(key);
}

/// Load something from the storage.
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

/// Save something to the storage under a namespaced key.
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

/// Remove the value of a namespaced key from the storage.
#[inline]
pub fn ns_remove <S: Storage> (
    storage:   &mut S,
    namespace: &[u8],
    key:       &[u8]
) {
    let key = concat(namespace, key);
    storage.remove(&key);
}

/// Load the value of a namespaced key.
#[inline]
pub fn ns_load <T: DeserializeOwned, S: ReadonlyStorage> (
    storage:   &S,
    namespace: &[u8],
    key:       &[u8]
) -> StdResult<Option<T>> {
    load(storage, &concat(namespace, key))
}

/// Concatenate a namespace and a key to get a namespaced key.
#[inline]
pub fn concat(
    namespace: &[u8],
    key:       &[u8]
) -> Vec<u8> {
    let mut k = namespace.to_vec();
    k.extend_from_slice(key);
    k
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

use crate::{
    scrt::*,
    scrt_storage::{
        load as storage_load,
        remove as storage_remove,
        save as storage_save,
    }
};
use serde::{de::DeserializeOwned, Serialize};

/// Trait that will add storage options to your struct,
/// at minimum, you will have to implement `key()` method that will let storage
/// know where to save or from where to load your data.
///
/// Optionally, you can define the namespace of your struct that
/// will namespace it when storing.
/// 
/// ```rust
/// use serde::{Deserialize, Serialize};
/// use fadroma::{scrt::*, scrt_storage_traits::*};
/// 
/// #[derive(Deserialize, Serialize)]
/// struct Config {
///     some_value: String,
/// }
/// 
/// impl Storable for Config {
///     fn key(&self) -> StdResult<Vec<u8>> {
///         Ok(to_vec(b"some_key")?)
///     }
/// }
/// 
/// fn init<S: Storage, A: Api, Q: Querier>(deps: &mut Extern<S, A, Q>) -> StdResult<()> {
///     let config = Config { some_value: "foo".to_string() };
/// 
///     config.save(deps)?;
/// 
///     let maybe_config: Option<Config> = Config::load(&deps, b"some_key")?;
/// 
///     Ok(())
/// }
/// ```
pub trait Storable: Serialize + DeserializeOwned {
    /// Storage key used for saving Self
    fn key(&self) -> StdResult<Vec<u8>>;

    /// Save Self in the storage
    fn save<S: Storage, A: Api, Q: Querier>(&self, deps: &mut Extern<S, A, Q>) -> StdResult<()> {
        let key = self.key()?;
        let key = key.as_slice();

        Self::static_save(deps, key, self)
    }

    /// Remove Self from storage
    fn remove<S: Storage, A: Api, Q: Querier>(self, deps: &mut Extern<S, A, Q>) -> StdResult<()> {
        let key = self.key()?;
        let key = key.as_slice();

        Self::static_remove(deps, key)
    }

    /// Static: namespace for self
    fn namespace() -> Vec<u8> {
        Vec::new()
    }

    /// Static: Concat of namespace and key
    fn concat_key(key: &[u8]) -> Vec<u8> {
        let mut ns = Self::namespace();
        ns.extend_from_slice(key);

        ns
    }

    /// Static: Load Self from the storage
    fn load<S: Storage, A: Api, Q: Querier>(
        deps: &Extern<S, A, Q>,
        key: &[u8],
    ) -> StdResult<Option<Self>> {
        let key = Self::concat_key(key);

        storage_load::<Self, S>(&deps.storage, key.as_slice())
    }

    /// Static: Save Self in the storage
    fn static_save<S: Storage, A: Api, Q: Querier>(
        deps: &mut Extern<S, A, Q>,
        key: &[u8],
        item: &Self,
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_save::<Self, S>(&mut deps.storage, &key.as_slice(), item)
    }

    /// Static: Remove Self from storage
    fn static_remove<S: Storage, A: Api, Q: Querier>(
        deps: &mut Extern<S, A, Q>,
        key: &[u8],
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_remove(&mut deps.storage, &key.as_slice());

        Ok(())
    }
}

pub use serde::{Serialize, de::DeserializeOwned};
use crate::{scrt::*, concat};

/// Trait for actor that operates in a context with readonly access to the storage.
pub trait Readonly <S: ReadonlyStorage> {
    /// Get the storage handle
    fn storage (&self) -> &S;
    /// Load a global
    fn load <T: DeserializeOwned> (&self, key: &[u8]) -> StdResult<Option<T>> {
        match self.storage().get(key) {
            Some(data) => from_slice(&data),
            None => Ok(None)
        }
    }
    /// Load a field
    fn load_ns <T: DeserializeOwned> (&self, ns: &[u8], key: &[u8]) -> StdResult<Option<T>> {
        self.load(&concat(ns, key))
    }
}

/// Trait for actor that operates in a context with mutable storage
pub trait Writable <S: Storage>: Readonly<S> {
    /// Get the mutable storage handle
    fn storage_mut (&mut self) -> &mut S;
    /// Save a global
    fn save <T: Serialize> (&mut self, key: &[u8], val: T) -> StdResult<&mut Self> {
        self.storage_mut().set(&key, &to_vec(&val)?);
        Ok(self)
    }
    /// Save a field
    fn save_ns <T: Serialize> (&mut self, ns: &[u8], key: &[u8], val: T) -> StdResult<&mut Self> {
        self.save(&concat(ns, key), val)
    }
}

#[macro_export] macro_rules! stateful {
    (
        $Obj:ident ($($storage:tt)+): /*{ $($accessors:tt)* } no traits no accessors */
        $Readonly:ident { $($readonlies:tt)* }
        $Writable:ident { $($writables:tt)* }
    ) => {
        impl<S: ReadonlyStorage> $Readonly<S> for $Obj<&S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<S: ReadonlyStorage> $Readonly<S> for $Obj<&mut S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<S: Storage> $Writable<S> for $Obj<&mut S> {
            fn storage_mut (&mut self) -> &mut S { &mut self.$($storage)+ }
        }
        impl<S: ReadonlyStorage> $Obj<&S> {
            $($readonlies)*
        }
        impl<S: Storage> $Obj<&mut S> {
            $($readonlies)*
            $($writables)*
        }
    };
}

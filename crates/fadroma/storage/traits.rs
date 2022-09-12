use fadroma_platform_scrt::cosmwasm_std::{from_slice, to_vec, StdResult, Storage};
use serde::{de::DeserializeOwned, Serialize};

use crate::storage::concat;

/// Trait for actor that operates in a context with readonly access to the storage.
pub trait Readonly<S: Storage> {
    /// Get the storage handle
    fn storage(&self) -> &S;
    /// Load a global
    fn load<T: DeserializeOwned>(&self, key: &[u8]) -> StdResult<Option<T>> {
        match self.storage().get(key) {
            Some(data) => from_slice(&data),
            None => Ok(None),
        }
    }
    /// Load a field
    fn load_ns<T: DeserializeOwned>(&self, ns: &[u8], key: &[u8]) -> StdResult<Option<T>> {
        self.load(&concat(ns, key))
    }
}

/// Trait for actor that operates in a context with mutable storage
pub trait Writable<S: Storage>: Readonly<S> {
    /// Get the mutable storage handle
    fn storage_mut(&mut self) -> &mut S;
    /// Save a global
    fn save<T: Serialize>(&mut self, key: &[u8], val: T) -> StdResult<&mut Self> {
        self.storage_mut().set(&key, &to_vec(&val)?);
        Ok(self)
    }
    /// Save a field
    fn save_ns<T: Serialize>(&mut self, ns: &[u8], key: &[u8], val: T) -> StdResult<&mut Self> {
        self.save(&concat(ns, key), val)
    }
}

/// Because Rust can't yet genericize over mutability, this macro can be used
/// to implement the same readonly methods twice - once for `&S` and for `&mut S`.
#[macro_export]
macro_rules! stateful {
    (
        $Obj:ident ($($storage:tt)+): /*{ $($accessors:tt)* } no traits no accessors */
        $Readonly:ident { $($readonlies:tt)* }
        $Writable:ident { $($writables:tt)* }
    ) => {
        impl<S: Storage> $Readonly<S> for $Obj<&S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<S: Storage> $Readonly<S> for $Obj<&mut S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<S: Storage> $Writable<S> for $Obj<&mut S> {
            fn storage_mut (&mut self) -> &mut S { &mut self.$($storage)+ }
        }
        impl<S: Storage> $Obj<&S> {
            $($readonlies)*
        }
        impl<S: Storage> $Obj<&mut S> {
            $($readonlies)*
            $($writables)*
        }
    };
}

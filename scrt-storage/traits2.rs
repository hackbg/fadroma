pub use serde::{Serialize, de::DeserializeOwned};
pub use fadroma_scrt_base::cosmwasm_std::{Storage, ReadonlyStorage, StdResult, to_vec, from_slice};

use crate::concat;

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
        $Obj:ident
        $(<$($p:tt),+>)?
        ($($storage:tt)+): /*{ $($accessors:tt)* } no traits no accessors */
        $Readonly:ident { $($readonlies:tt)* }
        $Writable:ident { $($writables:tt)* }
    ) => {
        impl<$($($p,)+)? S: ReadonlyStorage> $Readonly<S> for $Obj<$($($p,)+)? &S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<$($($p,)+)? S: ReadonlyStorage> $Readonly<S> for $Obj<$($($p,)+)? &mut S> {
            fn storage (&self) -> &S { &self.$($storage)+ }
        }
        impl<$($($p,)+)? S: Storage> $Writable<S> for $Obj<$($($p,)+)? &mut S> {
            fn storage_mut (&mut self) -> &mut S { &mut self.$($storage)+ }
        }
        impl<$($($p,)+)? S: ReadonlyStorage> $Obj<$($($p,)+)? &S> {
            $($readonlies)*
        }
        impl<$($($p,)+)? S: Storage> $Obj<$($($p,)+)? &mut S> {
            $($readonlies)*
            $($writables)*
        }
    };
}

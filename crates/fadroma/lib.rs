#[cfg(feature = "auth")]
pub mod auth;

#[cfg(feature = "composability")]
pub mod composability;

#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

#[cfg(feature = "derive")]
pub use fadroma_proc_derive as derive_contract;

#[cfg(feature = "killswitch")]
pub mod killswitch;

#[cfg(feature = "math")]
pub mod math;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt as scrt;

#[cfg(feature = "message")]
pub use fadroma_proc_message as proc_message;

#[cfg(feature = "snip20-client")]
pub mod snip20_client;

#[cfg(feature = "snip20-impl")]
pub mod snip20_impl;

#[cfg(feature = "storage")]
pub mod storage;

#[cfg(feature = "reexport-secret-toolkit")]
pub use secret_toolkit;

pub mod prelude {

    #[cfg(feature = "derive")]
    pub use fadroma_proc_derive::*;

    #[cfg(feature = "scrt")]
    pub use crate::scrt::{*, cosmwasm_std, cosmwasm_std::*};

    #[cfg(feature = "math")]
    pub use crate::math::*;

    #[cfg(feature = "storage")]
    pub use crate::storage::{
        load, save, remove,
        ns_load, ns_save, ns_remove
    };

    #[cfg(feature = "snip20-client")]
    pub use snip20_client::ISnip20;

}

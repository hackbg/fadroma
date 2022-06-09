#[cfg(feature = "auth")]
pub mod auth;

#[cfg(feature = "auth")]
pub use fadroma_proc_auth as auth_proc;

#[cfg(feature = "composability")]
pub mod composability;

#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

#[cfg(feature = "derive")]
pub use fadroma_proc_derive as derive;

#[cfg(feature = "killswitch")]
pub mod killswitch;

#[cfg(feature = "math")]
pub mod math;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt as scrt;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt::{
    cosmwasm_std, cosmwasm_storage, cosmwasm_schema, serde, schemars
};

#[cfg(feature = "message")]
pub use fadroma_proc_message as proc_message;

#[cfg(feature = "snip20-api")]
pub mod snip20_api;

#[cfg(feature = "snip20-impl")]
pub mod snip20_impl;

#[cfg(feature = "storage")]
pub mod storage;

pub mod prelude {

    #[cfg(feature = "scrt")]
    pub use crate::scrt::{
        Humanize, Canonize, CodeId, CodeHash,
        ContractLink, ContractInstantiationInfo,
        Callback, to_cosmos_msg, space_pad, BLOCK_SIZE
    };

    #[cfg(feature = "scrt")]
    pub use crate::math::*;

    #[cfg(feature = "storage")]
    pub use crate::storage::{
        load, save, remove,
        ns_load, ns_save, ns_remove
    };

}

#[cfg(feature = "auth")]
pub mod auth;

#[cfg(feature = "auth")]
pub use auth::*;

#[cfg(feature = "auth")]
pub use fadroma_proc_auth as auth_proc;

#[cfg(feature = "auth")]
pub use auth_proc::*;

#[cfg(feature = "composability")]
pub mod composability;

#[cfg(feature = "composability")]
pub use composability::*;

#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub use ensemble::*;

#[cfg(feature = "derive")]
pub use fadroma_proc_derive as derive_contract;

#[cfg(feature = "derive")]
pub use fadroma_proc_derive::*;

#[cfg(feature = "killswitch")]
pub mod killswitch;

#[cfg(feature = "killswitch")]
pub use killswitch::*;

#[cfg(feature = "math")]
pub mod math;

#[cfg(feature = "math")]
pub use math::*;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt as scrt;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt::*;

#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt::cosmwasm_std::*;

#[cfg(feature = "message")]
pub use fadroma_proc_message as proc_message;

#[cfg(feature = "message")]
pub use fadroma_proc_message::*;

#[cfg(feature = "snip20-client")]
pub mod snip20_client;

#[cfg(feature = "snip20-client")]
pub use snip20_client::*;

#[cfg(feature = "snip20-impl")]
pub mod snip20_impl;

#[cfg(feature = "snip20-impl")]
pub use snip20_impl::*;

#[cfg(feature = "storage")]
pub mod storage;

#[cfg(feature = "storage")]
pub use storage::*;

#[cfg(feature = "reexport-secret-toolkit")]
pub use secret_toolkit;

#[cfg(feature = "reexport-secret-toolkit")]
pub use secret_toolkit::*;

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

pub mod platform {

    #[cfg(feature = "scrt")]
    pub use fadroma_platform_scrt::cosmwasm_std::*;

    #[cfg(feature = "scrt")]
    pub use fadroma_platform_scrt::*;

    #[cfg(feature = "reexport-secret-toolkit")]
    pub use secret_toolkit;

}

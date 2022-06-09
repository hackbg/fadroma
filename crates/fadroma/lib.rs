// Supported platforms
#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt as scrt;

// Contract scaffoldings
#[cfg(feature = "derive")]
pub use fadroma_proc_derive as derive_contract;
#[cfg(feature = "composability")]
pub mod composability;

// Safety features
#[cfg(feature = "killswitch")]
pub mod killswitch;

// Authentication primitives
#[cfg(feature = "admin")]
pub mod admin;
#[cfg(feature = "permit")]
pub mod permit;
#[cfg(feature = "vk")]
pub mod vk;

// Tokenomics primitives
#[cfg(feature = "math")]
pub mod math;
#[cfg(feature = "snip20-client")]
pub mod snip20_client;
#[cfg(feature = "snip20-impl")]
pub mod snip20_impl;

// Data and I/O helpers
#[cfg(feature = "storage")]
pub mod storage;
#[cfg(feature = "message")]
pub use fadroma_proc_message as proc_message;
#[cfg(feature = "response")]
pub mod response;

// Testing system
#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

// TODO: Remove or compartmentalize dependency on this
#[cfg(feature = "reexport-secret-toolkit")]
pub use secret_toolkit;

pub mod prelude {

    pub type UsuallyOk = StdResult<()>;
    pub type Eventually<Value> = StdResult<Option<Value>>;

    #[cfg(feature = "derive")]
    pub use fadroma_proc_derive::*;

    #[cfg(feature = "scrt")]
    pub use crate::scrt::{*, cosmwasm_std, cosmwasm_std::*};

    #[cfg(feature = "math")]
    pub use crate::math::*;

    #[cfg(feature = "storage")]
    pub use crate::storage::{
        load, save, remove,
        ns_load, ns_save, ns_remove,
        IterableStorage
    };

    #[cfg(feature = "snip20-client")]
    pub use crate::snip20_client::ISnip20;

    #[cfg(feature = "message")]
    pub use crate::message::message;

    #[cfg(feature = "response")]
    pub use crate::response::*;

    #[cfg(feature = "admin")]
    pub use crate::admin::assert_admin;

    #[cfg(all(feature = "admin", feature = "derive"))]
    pub use crate::admin::require_admin;

    #[cfg(feature = "vk")]
    pub use crate::vk::ViewingKey;

    #[cfg(feature = "permit")]
    pub use crate::permit::{Permit, Permission};

}

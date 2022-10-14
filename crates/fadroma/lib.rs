// Supported platforms
#[cfg(feature = "scrt")]
pub use fadroma_platform_scrt as scrt;
#[cfg(feature = "scrt")]
pub use scrt::cosmwasm_std;
#[cfg(feature = "scrt")]
pub use scrt::schemars;
#[cfg(feature = "scrt")]
pub use scrt::serde;

#[cfg(feature = "scrt")]
pub mod core;

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
pub mod snip20;

// Data and I/O helpers
#[cfg(feature = "storage")]
pub mod storage;
#[cfg(feature = "message")]
pub use fadroma_proc_message as proc_message;
// Testing system
#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

// TODO: Remove or compartmentalize dependency on this
#[cfg(feature = "reexport-secret-toolkit")]
pub use secret_toolkit;

/// **Start here.** `use fadroma::prelude::*` to get the essentials for
/// writing smart contracts with Fadroma.
pub mod prelude {

    /// Alias for `StdResult<()>`.
    pub type UsuallyOk = StdResult<()>;

    /// Alias for `StdResult<Option<V>>`.
    pub type Eventually<V> = StdResult<Option<V>>;

    pub use crate::core::*;

    #[cfg(feature = "scrt")]
    pub use crate::scrt::{
        cosmwasm_std::{self, *},
        *,
    };

    #[cfg(feature = "scrt")]
    pub use schemars::{self, JsonSchema};

    #[cfg(feature = "math")]
    pub use crate::math::*;

    #[cfg(feature = "storage")]
    pub use crate::storage::{load, ns_load, ns_remove, ns_save, remove, save};

    #[cfg(feature = "message")]
    pub use crate::proc_message::message;

    #[cfg(feature = "vk")]
    pub use crate::vk::ViewingKey;

    #[cfg(feature = "permit")]
    pub use crate::permit::{Permission, Permit};

    #[cfg(feature = "composability")]
    pub use crate::composability::Composable;
}

/// Define the `mod wasm` entrypoint of production builds.
#[cfg(feature = "scrt")]
#[macro_export]
macro_rules! entrypoint {
    ($($fadroma:ident)::+, $($contract:ident)::+ $(,)?) => {
        $($fadroma)::+::entrypoint!(
            $($fadroma)::+,
            $($contract)::+::init,
            $($contract)::+::handle,
            $($contract)::+::query,
        );
    };
    ($($fadroma:ident)::+, $($init:ident)::+, $($handle:ident)::+, $($query:ident)::+ $(,)?) => {
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            use $($fadroma)::+::{scrt::cosmwasm_std::{
                do_instantiate,
                do_execute,
                do_query
            }};
            #[no_mangle] extern "C" fn instantiate(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
                do_instantiate(&super::$($init)::+, env_ptr, info_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn execute(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
                do_execute(&super::$($handle)::+, env_ptr, info_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn query(env_ptr: u32, msg_ptr: u32) -> u32 {
                do_query(&super::$($query)::+, env_ptr, msg_ptr)
            }
        }
    }
}

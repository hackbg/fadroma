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

// Tokenomics primitives
pub mod tokens;

// Contract scaffolding
pub use fadroma_proc_derive as derive_contract;

// Safety features
pub mod killswitch;

// Authentication primitives
pub mod admin;
#[cfg(feature = "permit")]
pub mod permit;
#[cfg(feature = "vk")]
pub mod vk;

#[cfg(feature = "crypto")]
pub mod crypto;
pub mod snip20;

// Storage helpers
pub mod storage;
pub use fadroma_proc_message as proc_message;
// Testing system
#[cfg(all(feature = "ensemble", not(target_arch = "wasm32")))]
pub mod ensemble;

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

    pub use crate::tokens::*;

    #[cfg(feature = "scrt")]
    pub use schemars::{self, JsonSchema};

    pub use crate::storage::{load, ns_load, ns_remove, ns_save, remove, save};

    pub use crate::proc_message::message;

    #[cfg(feature = "vk")]
    pub use crate::vk::{ViewingKey, ViewingKeyHashed};

    #[cfg(feature = "permit")]
    pub use crate::permit::{Permission, Permit};
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

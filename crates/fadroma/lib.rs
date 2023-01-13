#[cfg(not(feature = "scrt"))]
std::compile_error!("Fadroma only currently supports Secret Network so the \"scrt\" feature must be enabled.");

#[cfg(feature = "scrt")]
pub use secret_cosmwasm_std as cosmwasm_std;
pub use schemars;
pub use serde;

pub mod core;

#[cfg(feature = "scrt")]
pub mod scrt;

pub mod tokens;
pub use fadroma_proc_derive as derive_contract;
pub mod killswitch;
pub mod admin;
#[cfg(feature = "crypto")]
pub mod crypto;

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
    pub type UsuallyOk = cosmwasm_std::StdResult<()>;

    /// Alias for `StdResult<Option<V>>`.
    pub type Eventually<V> = cosmwasm_std::StdResult<Option<V>>;

    pub use crate::core::*;

    pub use crate::cosmwasm_std::{self, *};
    #[cfg(feature = "scrt")]
    pub use crate::scrt::{BLOCK_SIZE, to_cosmos_msg, space_pad};

    pub use crate::tokens::*;

    pub use schemars::{self, JsonSchema};

    pub use crate::storage::{load, ns_load, ns_remove, ns_save, remove, save};

    pub use crate::proc_message::message;

    #[cfg(feature = "vk")]
    pub use crate::scrt::vk::{ViewingKey, ViewingKeyHashed};

    #[cfg(feature = "permit")]
    pub use crate::scrt::permit::{Permission, Permit};
}

/// Define the `mod wasm` entrypoint of production builds.
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

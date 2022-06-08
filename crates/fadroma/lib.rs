pub use fadroma_auth as auth;
pub use fadroma_auth_proc as auth_proc;
pub use fadroma_composability as composability;
#[cfg(feature = "declare")]
pub use fadroma_declare_contract as declare_contract;
#[cfg(feature = "derive")]
pub use fadroma_derive_contract as derive_contract;
#[cfg(not(target_arch = "wasm32"))]
pub use fadroma_ensemble as ensemble;
pub use fadroma_killswitch as killswitch;
pub use fadroma_math as math;
pub use fadroma_platform_scrt::{
    cosmwasm_std, cosmwasm_storage, cosmwasm_schema, serde, schemars
};
pub use fadroma_proc_message as proc_message;
pub use fadroma_snip20_api;
pub use fadroma_snip20_impl as snip20_impl;
pub use fadroma_storage as storage;

pub mod prelude {
    pub use fadroma_platform_scrt::{
        Humanize, Canonize, CodeId, CodeHash,
        ContractLink, ContractInstantiationInfo,
        Callback, to_cosmos_msg, space_pad, BLOCK_SIZE
    };
    pub use fadroma_math::*;
    pub use fadroma_storage::{
        load, save, remove,
        ns_load, ns_save, ns_remove
    };
}

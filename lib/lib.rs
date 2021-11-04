mod composable;
pub use composable::*;

mod response_builder;
pub use response_builder::*;

mod crypto;
pub use crypto::*;

mod decimal;
pub use decimal::*;

mod uint256;
pub use uint256::*;

#[cfg(feature="scrt")]
pub mod scrt {
    pub const BLOCK_SIZE: usize = 256;
    pub use cosmwasm_std::*;
    #[cfg(test)] pub use cosmwasm_std::testing::*;
    pub use cosmwasm_storage::*;
    pub use cosmwasm_schema::*;
    pub use snafu;
    pub use schemars;
    pub use secret_toolkit;
}

#[cfg(feature="scrt")] pub use scrt::*;

#[cfg(feature="scrt-addr")]       pub mod scrt_addr;
#[cfg(feature="scrt-addr")]       pub use scrt_addr::*;

#[cfg(feature="scrt-admin")]      mod composable_admin;
#[cfg(feature="scrt-admin")]      pub use composable_admin::admin;
#[cfg(feature="scrt-admin")]      pub use composable_admin::multi_admin as multi;
#[cfg(feature="scrt-admin")]      pub use require_admin;

#[cfg(feature="scrt-contract")]   pub mod scrt_contract;
#[cfg(feature="scrt-contract")]   pub mod scrt_contract_api;
#[cfg(feature="scrt-contract")]   pub mod scrt_contract_binding;
#[cfg(feature="scrt-contract")]   pub mod scrt_contract_harness;
#[cfg(feature="scrt-contract")]   pub mod scrt_contract_impl;
#[cfg(feature="scrt-contract")]   pub mod scrt_contract_state;
#[cfg(feature="scrt-contract")]   pub use scrt_contract::*;
#[cfg(feature="scrt-contract")]   pub use scrt_contract_api::*;
#[cfg(all(test, feature="scrt-contract"))]   pub use scrt_contract_harness::*;

#[cfg(feature="scrt-icc")]        pub mod scrt_callback;
#[cfg(feature="scrt-icc")]        pub use scrt_callback::*;
#[cfg(feature="scrt-icc")]        pub mod scrt_link;
#[cfg(feature="scrt-icc")]        pub use scrt_link::*;

#[cfg(feature="scrt-snip20-api")] pub mod scrt_snip20_api;
#[cfg(feature="scrt-snip20-api")] pub use scrt_snip20_api::*;

#[cfg(feature="scrt-storage")]    pub mod scrt_storage;
#[cfg(feature="scrt-storage")]    pub mod scrt_storage_traits;
#[cfg(feature="scrt-storage")]    pub mod scrt_storage_traits2;
#[cfg(feature="scrt-storage")]    pub use scrt_storage::*;

#[cfg(feature="scrt-vk")]         pub mod scrt_vk;
#[cfg(feature="scrt-vk")]         pub use scrt_vk::*;

#[cfg(feature="scrt-vk")]         pub mod scrt_vk_auth;
//#[cfg(feature="scrt-vk")]         pub use scrt_vk_auth::*;
// pollutes namespace with generated HandleMsg/QueryMsg enums

// also pollutes namespace but can't be disabled due to the macro contained within
// (or can it?)
#[cfg(feature="scrt-migrate")]    pub mod scrt_migrate;
#[cfg(feature="scrt-migrate")]    pub use scrt_migrate::*;


#[cfg(feature="derive")]          pub use derive_contract;

#[cfg(feature="terra")] mod terra; 
#[cfg(feature="terra")] pub use terra::*;

#[cfg(feature="derive")]
pub use derive_contract;

#[cfg(feature="scrt")]
pub use fadroma_scrt as scrt;

#[cfg(feature="scrt")]
pub use fadroma_scrt::*;

#[cfg(feature="scrt-addr")]
pub mod scrt_addr;

#[cfg(feature="scrt-addr")]
pub use scrt_addr::*;

#[cfg(feature="scrt-admin")]
mod composable_admin;

#[cfg(feature="scrt-admin")]
pub use composable_admin::admin;

#[cfg(feature="scrt-admin")]
pub use composable_admin::multi_admin as multi;

#[cfg(feature="scrt-admin")]
pub use require_admin;

#[cfg(feature="scrt-contract")]
mod declare_contract;

#[cfg(feature="scrt-contract")]
pub use declare_contract::*;

#[cfg(feature="scrt-icc")]
pub mod scrt_callback;

#[cfg(feature="scrt-icc")]
pub use scrt_callback::*;

#[cfg(feature="scrt-icc")]
pub mod scrt_link;

#[cfg(feature="scrt-icc")]
pub use scrt_link::*;

#[cfg(feature="scrt-snip20-api")]
pub mod scrt_snip20_api;

#[cfg(feature="scrt-snip20-api")]
pub use scrt_snip20_api::*;

#[cfg(feature="scrt-storage")]
pub mod scrt_storage;

#[cfg(feature="scrt-storage")]
pub mod scrt_storage_traits;

#[cfg(feature="scrt-storage")]
pub mod scrt_storage_traits2;

#[cfg(feature="scrt-storage")]
pub use scrt_storage::*;

#[cfg(feature="scrt-vk")]
pub mod scrt_vk;

#[cfg(feature="scrt-vk")]
pub use scrt_vk::*;

#[cfg(feature="scrt-vk")]
pub mod scrt_vk_auth;
//#[cfg(feature="scrt-vk")]
//pub use scrt_vk_auth::*;
// pollutes namespace with generated HandleMsg/QueryMsg enums

#[cfg(feature="scrt-permit")]
pub mod scrt_permit;

#[cfg(feature="scrt-permit")]
pub use scrt_permit::*;

#[cfg(feature="scrt-migrate")]
pub mod scrt_migrate;
// also pollutes namespace but can't be disabled
// due to the macro contained within (or can it?)
#[cfg(feature="scrt-migrate")]
pub use scrt_migrate::*;

#[cfg(feature="terra")]
mod terra;

#[cfg(feature="terra")]
pub use terra::*;

mod composable_core;
pub use composable_core::*;

mod response_builder;
pub use response_builder::*;

mod crypto;
pub use crypto::*;

mod decimal;
pub use decimal::*;

mod uint256;
pub use uint256::*;

#[cfg(feature="scrt")] pub use scrt::*;
#[cfg(feature="scrt")] pub mod scrt {

    pub use cosmwasm_std::*;
    #[cfg(test)] pub use cosmwasm_std::testing::*;

    pub use cosmwasm_storage::*;

    pub use cosmwasm_schema::*;

    pub use snafu;

    pub use schemars;

    pub use secret_toolkit;

    pub const BLOCK_SIZE: usize = 256;

    pub fn to_cosmos_msg (
        contract_addr:      HumanAddr,
        callback_code_hash: String,
        msg:                &impl serde::Serialize,
    ) -> StdResult<CosmosMsg> {
        let mut msg = to_binary(msg)?;
        space_pad(&mut msg.0, BLOCK_SIZE);
        let send = Vec::new();
        Ok(WasmMsg::Execute { msg, contract_addr, callback_code_hash, send }.into())
    }

    /// Take a Vec<u8> and pad it up to a multiple of `block_size`,
    /// using spaces at the end.
    pub fn space_pad (
        message:    &mut Vec<u8>,
        block_size: usize
    ) -> &mut Vec<u8> {
        let len     = message.len();
        let surplus = len % block_size;
        if surplus == 0 { return message; }
        let missing = block_size - surplus;
        message.reserve(missing);
        message.extend(std::iter::repeat(b' ').take(missing));
        message
    }

}

#[cfg(feature="scrt-addr")]       pub mod scrt_addr;
#[cfg(feature="scrt-addr")]       pub use scrt_addr::*;

#[cfg(feature="scrt-admin")]      mod composable_admin;
#[cfg(feature="scrt-admin")]      pub use composable_admin::admin;
#[cfg(feature="scrt-admin")]      pub use composable_admin::multi_admin as multi;
#[cfg(feature="scrt-admin")]      pub use require_admin;

#[cfg(feature="scrt-contract")]   mod declare_contract;
#[cfg(feature="scrt-contract")]   pub use declare_contract::*;

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

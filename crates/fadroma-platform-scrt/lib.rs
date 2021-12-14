pub use cosmwasm_std;
pub use cosmwasm_std::*;

#[cfg(any(test,not(target_arch="wasm32")))]
pub use cosmwasm_std::testing;

#[cfg(any(test,not(target_arch="wasm32")))]
pub use cosmwasm_std::testing::*;

pub use cosmwasm_storage;
pub use cosmwasm_storage::*;

pub use cosmwasm_schema;
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

mod addr;
pub use addr::*;

mod link;
pub use link::*;

mod callback;
pub use callback::*;

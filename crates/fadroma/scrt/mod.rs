//! Secret Network specific utilities and contracts commonly
//! used when developing smart contracts for that network.
//! *Feature flag: `scrt`*

#[cfg(feature = "permit")]
pub mod permit;
#[cfg(feature = "vk")]
pub mod vk;
pub mod snip20;

use crate::cosmwasm_std::{StdResult, CosmosMsg, WasmMsg, to_binary};

/// Default Secret Network message padding size.
pub const BLOCK_SIZE: usize = 256;

/// Creates a new [`WasmMsg::Execute`] using the provided `msg`
/// and padding it to [`BLOCK_SIZE`].
pub fn to_cosmos_msg (
    contract_addr: String,
    code_hash: String,
    msg: &impl serde::Serialize,
) -> StdResult<CosmosMsg> {
    let mut msg = to_binary(msg)?;
    space_pad(&mut msg.0, BLOCK_SIZE);

    Ok(WasmMsg::Execute {
        msg,
        contract_addr,
        code_hash,
        funds: vec![]
    }.into())
}

/// Take a Vec<u8> and pad it up to a multiple of `block_size`,
/// using spaces at the end.
pub fn space_pad (
    message: &mut Vec<u8>,
    block_size: usize
) -> &mut Vec<u8> {
    let len = message.len();
    let surplus = len % block_size;

    if surplus == 0 {
        return message;
    }

    let missing = block_size - surplus;
    message.reserve(missing);
    message.extend(std::iter::repeat(b' ').take(missing));

    message
}

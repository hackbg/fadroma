pub use secret_cosmwasm_std as cosmwasm_std;
pub use secret_cosmwasm_storage as cosmwasm_storage;
pub use cosmwasm_schema;

pub use serde;
pub use schemars::{self, JsonSchema};

pub mod addr;
pub use addr::{Humanize, Canonize};

mod link;
pub use link::*;

mod callback;
pub use callback::*;

use cosmwasm_std::{HumanAddr, StdResult, CosmosMsg, WasmMsg, to_binary};

pub const BLOCK_SIZE: usize = 256;

pub fn to_cosmos_msg (
    contract_addr: HumanAddr,
    callback_code_hash: String,
    msg: &impl serde::Serialize,
) -> StdResult<CosmosMsg> {
    let mut msg = to_binary(msg)?;
    space_pad(&mut msg.0, BLOCK_SIZE);

    Ok(WasmMsg::Execute {
        msg,
        contract_addr,
        callback_code_hash,
        send: vec![]
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

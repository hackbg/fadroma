//! Transaction authentication by pre-configured admin address.

pub mod simple;
pub mod two_step;

pub use fadroma_proc_auth::*;

use crate::cosmwasm_std::{
    Deps, DepsMut, MessageInfo, Addr,
    CanonicalAddr, StdResult, StdError
};

const ADMIN_KEY: &[u8] = b"ltp5P6sFZT";

/// Initializes the admin module. Sets the messages sender as the admin
/// if `address` is `None`. You must **must** call this in you instantiate message.
pub fn init(
    deps: DepsMut,
    address: Option<&str>,
    info: &MessageInfo
) -> StdResult<()> {
    let admin = if let Some(addr) = address {
        &addr
    } else {
        info.sender.as_str()
    };

    save(deps, &admin)
}

/// Loads the current admin from storage if any was set. 
pub fn load(deps: Deps) -> StdResult<Option<Addr>> {
    let result = deps.storage.get(ADMIN_KEY);

    match result {
        Some(bytes) => {
            let admin = CanonicalAddr::from(bytes);

            Ok(Some(deps.api.addr_humanize(&admin)?))
        }
        None => Ok(None),
    }
}

/// Saves the `address` as the new admin to storage.
pub fn save(deps: DepsMut, address: &str) -> StdResult<()> {
    let address = deps.api.addr_canonicalize(address)?;
    deps.storage.set(ADMIN_KEY, address.as_slice());

    Ok(())
}

/// Asserts that the message sender is the admin. Otherwise returns an `Err`.
pub fn assert(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admin = load(deps)?;

    if let Some(addr) = admin {
        if addr == info.sender {
            return Ok(());
        }
    }

    Err(StdError::generic_err("Unauthorized"))
}

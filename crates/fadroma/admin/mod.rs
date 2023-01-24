//! Transaction authentication by pre-configured admin address.

pub mod simple;
pub mod two_step;

pub use fadroma_proc_auth::*;

use crate::{
    core::Canonize,
    storage::SingleItem,
    cosmwasm_std::{
        Deps, DepsMut, MessageInfo, CanonicalAddr, StdResult, StdError
    }
};

crate::namespace!(pub AdminNs, b"ltp5P6sFZT");
pub const STORE: SingleItem<CanonicalAddr, AdminNs> = SingleItem::new();

/// Initializes the admin module. Sets the messages sender as the admin
/// if `address` is `None`. You **must** call this in your instantiate message.
/// 
/// Returns the admin address that was set.
pub fn init(
    deps: DepsMut,
    address: Option<&str>,
    info: &MessageInfo
) -> StdResult<CanonicalAddr> {
    let admin = if let Some(addr) = address {
        &addr
    } else {
        info.sender.as_str()
    };

    let admin = admin.canonize(deps.api)?;
    STORE.save(deps.storage, &admin)?;

    Ok(admin)
}

/// Asserts that the message sender is the admin. Otherwise returns an `Err`.
pub fn assert(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admin = STORE.load_humanize(deps)?;

    if let Some(addr) = admin {
        if addr == info.sender {
            return Ok(());
        }
    }

    Err(StdError::generic_err("Unauthorized"))
}

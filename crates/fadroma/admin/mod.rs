//! Transaction authentication by pre-configured admin address.

pub mod simple;
pub mod two_step;

pub use fadroma_proc_auth::*;

use crate::{
    self as fadroma,
    storage::SingleItem,
    cosmwasm_std::{
        Deps, DepsMut, MessageInfo, CanonicalAddr, StdResult, StdError
    }
};

crate::namespace!(pub AdminNs, b"ltp5P6sFZT");
pub const STORE: SingleItem<CanonicalAddr, AdminNs> = SingleItem::new();

/// Initializes the admin module. Sets the messages sender as the admin
/// if `address` is `None`. You **must** call this in your instantiate message.
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

    STORE.canonize_and_save(deps, admin)
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

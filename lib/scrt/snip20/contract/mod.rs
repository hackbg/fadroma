//! Customizable implementation of a SNIP-20 token.

pub mod receiver;
pub mod state;
pub mod transaction_history;
pub mod safe_math;
pub mod decoy;
pub(crate) mod snip20;
mod symbol_validation;

pub use snip20::{
    instantiate,
    default_impl::{
        Contract as DefaultImpl,
        Error, ExecuteMsg, QueryMsg, execute, query,
        transfer_impl, transfer_from_impl, perform_transfer,
        send_impl, send_from_impl, add_receiver_api_callback,
        use_allowance, mint_impl
    }
};
pub use symbol_validation::*;

#[cfg(test)]
mod tests;

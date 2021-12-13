pub mod msg;
pub mod receiver;
pub mod state;
pub mod batch;
pub mod transaction_history;

mod snip20; pub use snip20::*;
mod utils;

#[cfg(test)] mod tests;

/// Implements SNIP20, SNIP21 and SNIP22.
pub struct DefaultSnip20Impl;

impl Snip20 for DefaultSnip20Impl { }

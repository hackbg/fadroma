pub use fadroma::scrt::callback::{Callback, ContractInstance};
pub use snip20::*;

pub mod msg;
pub mod receiver;
pub mod state;
#[cfg(feature = "snip22")]
pub mod batch;
#[cfg(feature = "snip21")]
pub mod transaction_history;

mod snip20;
mod utils;

#[cfg(test)]
mod tests_shared;
#[cfg(test)]
#[cfg(not(feature = "snip21"))]
#[cfg(not(feature = "snip22"))]
mod snip20_tests;
#[cfg(all(test, feature = "snip21"))]
mod snip21_tests;
#[cfg(all(test, feature = "snip22"))]
mod snip22_tests;

/// Implements SNIP20, SNIP21 and SNIP22.
pub struct DefaultSnip20Impl;

impl Snip20 for DefaultSnip20Impl { }

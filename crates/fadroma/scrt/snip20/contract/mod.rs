//! Customizable implementation of a SNIP-20 token.

pub mod receiver;
pub mod state;
pub mod transaction_history;
mod symbol_validation;
mod snip20;

pub use snip20::*;
pub use symbol_validation::*;

#[cfg(test)]
mod tests;

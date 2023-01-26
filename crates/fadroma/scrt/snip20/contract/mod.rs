//! Customizable implementation of a SNIP-20 token.
//! *Feature flag: `snip20-impl`*
//! 
//! If you simply need a vanilla SNIP-20 token you only need to
//! look at the [`instantiate`], [`execute`] and [`query`] functions.
//! Call those from the respective entry points of your contract and
//! pass [`DefaultImpl`] as the last parameter.
//! 
//! All other functions and modules are exposed for convenience so that you 
//! don't need to copy code from here in order to make some changes to a method.
//! 
//! The the only methods which you might want to customize are
//! [`Snip20::symbol_validation`] and [`Snip20::name_range`] which specify
//! what characters can the token symbol be consisted of and between how
//! many characters long can the token name be.
//! 

pub mod msg;
pub mod receiver;
pub mod state;
pub mod transaction_history;

mod snip20;
pub use snip20::*;

#[cfg(test)]
mod tests;

/// The vanilla implementation of the SNIP-20 standard.
/// Pass this to the [`instantiate`], [`execute`] and [`query`]
/// entry points if you don't need to make any modifications.
pub struct DefaultImpl;

impl Snip20 for DefaultImpl { }

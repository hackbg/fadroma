use fadroma::{prelude::*, dsl::*};

// The message enum variants for this contract will be
// generated here. This allows you to have just the definitions
// in a separate crate so that they can be imported in multiple
// contracts without causing cyclical crate references.

#[interface]
pub trait Counter {
    type Error: std::fmt::Display;

    #[init]
    fn new(initial_value: u64) -> Result<Response, Self::Error>;

    #[execute]
    fn add(value: u64) -> Result<Response, Self::Error>;

    #[execute]
    fn sub(value: u64) -> Result<Response, Self::Error>;

    #[execute]
    fn mul(value: u64) -> Result<Response, Self::Error>;

    #[execute]
    fn div(value: u64) -> Result<Response, Self::Error>;

    #[query]
    fn value() -> Result<u64, Self::Error>;
}

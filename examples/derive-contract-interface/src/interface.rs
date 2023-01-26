use fadroma::{prelude::*, derive_contract::*};

// The message enum variants for this contract will be
// generated here. This allows you to have just the definitions
// in a separate crate so that they can be imported in multiple
// contracts without causing cyclical crate references.

#[interface]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<Response>;

    #[execute]
    fn add(value: u64) -> StdResult<Response>;

    #[execute]
    fn sub(value: u64) -> StdResult<Response>;

    #[execute]
    fn mul(value: u64) -> StdResult<Response>;

    #[execute]
    fn div(value: u64) -> StdResult<Response>;

    #[query]
    fn value() -> StdResult<u64>;
}

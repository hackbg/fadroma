use fadroma::{prelude::*, derive_contract::*};

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

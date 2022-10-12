use fadroma::{prelude::*, derive_contract::*};
use serde::{Deserialize, Serialize};

#[interface]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<Response>;

    #[handle]
    fn add(value: u64) -> StdResult<Response>;

    #[handle]
    fn sub(value: u64) -> StdResult<Response>;

    #[handle]
    fn mul(value: u64) -> StdResult<Response>;

    #[handle]
    fn div(value: u64) -> StdResult<Response>;

    #[query]
    fn state() -> StdResult<StateResponse>;
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct StateResponse {
    pub value: u64,
}

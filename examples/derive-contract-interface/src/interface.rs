use fadroma::{prelude::*, derive_contract::*};
use serde::{Deserialize, Serialize};

#[interface]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<InitResponse>;

    #[handle]
    fn add(value: u64) -> StdResult<HandleResponse>;

    #[handle]
    fn sub(value: u64) -> StdResult<HandleResponse>;

    #[handle]
    fn mul(value: u64) -> StdResult<HandleResponse>;

    #[handle]
    fn div(value: u64) -> StdResult<HandleResponse>;

    #[query]
    fn state() -> StdResult<StateResponse>;
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct StateResponse {
    pub value: u64,
}

use serde::{Serialize, Deserialize};
use fadroma::{schemars, dsl::*, prelude::*};

#[derive(Serialize, Deserialize, schemars::JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct Pagination {
    pub start: u64,
    pub limit: u8
}

#[derive(Serialize, Deserialize, schemars::JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct PaginatedResponse<T: Serialize> {
    pub total: u64,
    pub entries: Vec<T>
}

impl Pagination {
    pub const LIMIT: u8 = 30;
}

#[interface]
pub trait Product {
    type Error: std::fmt::Display;
    #[init] fn new() -> Result<Response, <Self as Product>::Error>;
}

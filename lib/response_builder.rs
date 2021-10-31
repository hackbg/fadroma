//! note: see issue #35203 <https://github.com/rust-lang/rust/issues/35203>
#![allow(patterns_in_fns_without_body)]

use crate::*;

pub trait HandleResponseBuilder {
    fn msg (mut self, msg: CosmosMsg) ->
        StdResult<Self> where Self: Sized;
    fn log (mut self, key: &str, value: &str) ->
        StdResult<Self> where Self: Sized;
    fn data <T: serde::Serialize> (mut self, data: &T) ->
        StdResult<Self> where Self: Sized;
}

impl HandleResponseBuilder for HandleResponse {
    fn msg (mut self, msg: CosmosMsg) -> StdResult<Self> {
        self.messages.push(msg);
        Ok(self)
    }
    fn log (mut self, key: &str, value: &str) -> StdResult<Self> {
        self.log.push(LogAttribute { key: key.to_string(), value: value.to_string() });
        Ok(self)
    }
    fn data <T: serde::Serialize> (mut self, data: &T) -> StdResult<Self> {
        self.data = Some(to_binary(data)?);
        Ok(self)
    }
}


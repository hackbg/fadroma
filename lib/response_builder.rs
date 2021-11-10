//! note: see issue #35203 <https://github.com/rust-lang/rust/issues/35203>
#![allow(patterns_in_fns_without_body)]

use crate::*;

pub trait HandleResponseBuilder: Sized {
    fn msg (mut self, msg: CosmosMsg) ->
        StdResult<Self>;
    fn msg_to (mut self, contract: ContractLink<HumanAddr>, msg: &impl serde::Serialize) ->
        StdResult<Self>;
    fn log (mut self, key: &str, value: &str) ->
        StdResult<Self>;
    fn data <T: serde::Serialize> (mut self, data: &T) ->
        StdResult<Self>;
}

impl HandleResponseBuilder for HandleResponse {
    fn msg (mut self, msg: CosmosMsg) -> StdResult<Self> {
        self.messages.push(msg);
        Ok(self)
    }
    fn msg_to (
        mut self, contract: ContractLink<HumanAddr>, msg: &impl serde::Serialize
    ) -> StdResult<Self> {
        let msg = to_cosmos_msg(contract.address, contract.code_hash, msg)?;
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


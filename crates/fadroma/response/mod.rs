//! note: see issue #35203 <https://github.com/rust-lang/rust/issues/35203>
#![allow(patterns_in_fns_without_body)]

use crate::prelude::*;

pub trait ResponseBuilder: Sized {
    fn msg (mut self, msg: CosmosMsg) -> StdResult<Self>;
    fn msg_to (mut self, contract: ContractLink<HumanAddr>, msg: &impl serde::Serialize)
        -> StdResult<Self>;
    fn log (mut self, key: &str, value: &str) -> StdResult<Self>;
    fn data <T: serde::Serialize> (mut self, data: &T) -> StdResult<Self>;
    fn merge (mut self, mut other: Self) -> StdResult<Self>;
}

impl ResponseBuilder for InitResponse {
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
        self.log.push(log(key, value));
        Ok(self)
    }
    fn data <T: serde::Serialize> (self, _: &T) -> StdResult<Self> {
        unimplemented!(); // InitResponse does not have data field
    }
    fn merge (mut self, mut other: Self) -> StdResult<Self> {
        self.messages.append(&mut other.messages);
        self.log.append(&mut other.log);
        Ok(self)
    }
}

impl ResponseBuilder for HandleResponse {
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
        self.log.push(log(key, value));
        Ok(self)
    }
    fn data <T: serde::Serialize> (mut self, data: &T) -> StdResult<Self> {
        self.data = Some(to_binary(data)?);
        Ok(self)
    }
    fn merge (mut self, mut other: Self) -> StdResult<Self> {
        self.messages.append(&mut other.messages);
        self.log.append(&mut other.log);
        Ok(self)
    }
}

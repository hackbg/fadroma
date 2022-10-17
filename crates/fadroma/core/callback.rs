use crate::{
    self as fadroma,
    prelude::Canonize,
    cosmwasm_std::{self, Addr, Binary, CosmosMsg, WasmMsg},
    schemars::{self, JsonSchema}
};
use super::link::ContractLink;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Canonize, Clone, Debug, PartialEq, JsonSchema)]
/// Info needed to have the other contract respond.
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractLink<A>
}

impl Into<CosmosMsg> for Callback<Addr> {
    fn into(self) -> CosmosMsg {
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: self.contract.address.to_string(),
            code_hash: self.contract.code_hash,
            msg: self.msg,
            funds: vec![]
        })
    }
}

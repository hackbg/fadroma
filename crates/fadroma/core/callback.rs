use crate::{
    self as fadroma,
    prelude::Canonize,
    cosmwasm_std::{self, StdResult, Api, Addr, Binary, CosmosMsg, WasmMsg},
    schemars::{self, JsonSchema}
};
use super::link::ContractLink;

use serde::{Deserialize, Serialize};

/// Info needed to have the other contract respond.
/// This was mainly only useful in CW 0.10 where reply
/// functionality didn't exist yet.
#[derive(Serialize, Deserialize, Canonize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractLink<A>
}

impl Callback<String> {
    #[inline]
    pub fn validate(self, api: &dyn Api) -> StdResult<Callback<Addr>> {
        Ok(Callback {
            msg: self.msg,
            contract: self.contract.validate(api)?
        })
    }
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

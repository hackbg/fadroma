use crate::{
    self as fadroma,
    prelude::Canonize,
    cosmwasm_std::{self, StdResult, Api, Addr, Binary, CosmosMsg, WasmMsg},
    schemars::{self, JsonSchema}
};
use super::{
    link::ContractLink,
    addr::MaybeAddress
};

use serde::{Deserialize, Serialize};

/// Info needed to have the other contract respond.
/// This was mainly only useful in CW 0.10 where reply functionality
/// didn't exist yet. However, it is still useful when you want to
/// be able to reply with arbitrary messages.
#[derive(Serialize, Deserialize, Canonize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Callback<A: MaybeAddress> {
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
            contract_addr: self.contract.address.into_string(),
            code_hash: self.contract.code_hash,
            msg: self.msg,
            funds: vec![]
        })
    }
}

impl Into<CosmosMsg> for Callback<String> {
    fn into(self) -> CosmosMsg {
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: self.contract.address,
            code_hash: self.contract.code_hash,
            msg: self.msg,
            funds: vec![]
        })
    }
}

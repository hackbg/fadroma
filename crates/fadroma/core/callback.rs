use crate::{
    cosmwasm_std::{StdResult, HumanAddr, CanonicalAddr, Api, Binary, CosmosMsg, WasmMsg},
    schemars::{self, JsonSchema}
};
use super::{
    addr::{Humanize, Canonize},
    link::ContractLink
};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
/// Info needed to have the other contract respond.
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractLink<A>
}

impl Humanize for Callback<CanonicalAddr> {
    type Output = Callback<HumanAddr>;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(Callback {
            msg: self.msg,
            contract: self.contract.humanize(api)?
        })
    }
}

impl Canonize for Callback<HumanAddr> {
    type Output = Callback<CanonicalAddr>;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(Callback {
            msg: self.msg,
            contract: self.contract.canonize(api)?
        })
    }
}

impl Into<CosmosMsg> for Callback<HumanAddr> {
    fn into(self) -> CosmosMsg {
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: self.contract.address,
            callback_code_hash: self.contract.code_hash,
            msg: self.msg,
            send: vec![]
        })
    }
}

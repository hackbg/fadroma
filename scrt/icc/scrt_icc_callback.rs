use cosmwasm_std::{HumanAddr, CanonicalAddr, StdResult, Api, Binary};
use fadroma_scrt_addr::{Humanize, Canonize};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use crate::scrt_icc_link::ContractLink

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
/// Info needed to have the other contract respond.
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractLink<A>
}
impl Canonize<Callback<CanonicalAddr>> for Callback<HumanAddr> {
    fn canonize (&self, api: &impl Api) -> StdResult<Callback<CanonicalAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.canonize(api)? })
    }
}
impl Humanize<Callback<HumanAddr>> for Callback<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<Callback<HumanAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.humanize(api)? })
    }
}

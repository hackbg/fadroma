use crate::{
    scrt::{StdResult, Addr, CanonicalAddr, Api, Binary},
    scrt_link::ContractLink,
    scrt_addr::{Canonize, Humanize}
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
/// Info needed to have the other contract respond.
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractLink<A>
}
impl Canonize<Callback<CanonicalAddr>> for Callback<Addr> {
    fn canonize (&self, api: &dyn Api) -> StdResult<Callback<CanonicalAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.canonize(api)? })
    }
}
impl Humanize<Callback<Addr>> for Callback<CanonicalAddr> {
    fn humanize (self, api: &dyn Api) -> StdResult<Callback<Addr>> {
        Ok(Callback { msg: self.msg, contract: self.contract.humanize(api)? })
    }
}

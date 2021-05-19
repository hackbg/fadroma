use cosmwasm_std::{HumanAddr, CanonicalAddr, StdResult, Api, Binary};
use fadroma_scrt_addr::{Humanize, Canonize};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: String,
    pub id: u64
}

/// Info needed to talk to a contract instance.
#[derive(Default, Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstance<A> {
    pub address: A,
    pub code_hash: String
}
impl Canonize<ContractInstance<CanonicalAddr>> for ContractInstance<HumanAddr> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<ContractInstance<CanonicalAddr>> {
        Ok(ContractInstance {
            address:   self.address.canonize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}
impl Humanize<ContractInstance<HumanAddr>> for ContractInstance<CanonicalAddr> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<ContractInstance<HumanAddr>> {
        Ok(ContractInstance {
            address:   self.address.humanize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}

#[deprecated(note="Please use ContractInstance<HumanAddr> instead.")]
pub type ContractInfo = ContractInstance<HumanAddr>;

#[deprecated(note="Please use ContractInstance<CanonicalAddr> instead.")]
pub type ContractInfoStored = ContractInstance<CanonicalAddr>;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
/// Info needed to have the other contract respond.
pub struct Callback<A> {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractInstance<A>
}
impl Canonize<Callback<CanonicalAddr>> for Callback<HumanAddr> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<Callback<CanonicalAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.canonize(api)? })
    }
}
impl Humanize<Callback<HumanAddr>> for Callback<CanonicalAddr> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<Callback<HumanAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.humanize(api)? })
    }
}

#[deprecated(note="Please use Callback<CanonicalAddr> instead.")]
pub type CallbackStored = Callback<CanonicalAddr>;

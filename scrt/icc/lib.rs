use cosmwasm_std::{HumanAddr, CanonicalAddr, StdResult, Api, Binary};
use fadroma_scrt_addr::{Humanize, Canonize};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub type CodeId = u64;
pub type CodeHash = String;

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: CodeHash,
    pub id:        CodeId
}

/// Info needed to talk to a contract instance.
#[derive(Default, Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstance<A> {
    pub address:   A,
    pub code_hash: CodeHash
}
impl Canonize<ContractInstance<CanonicalAddr>> for ContractInstance<HumanAddr> {
    fn canonize (&self, api: &impl Api) -> StdResult<ContractInstance<CanonicalAddr>> {
        Ok(ContractInstance {
            address:   self.address.canonize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}
impl Humanize<ContractInstance<HumanAddr>> for ContractInstance<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<ContractInstance<HumanAddr>> {
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
    fn canonize (&self, api: &impl Api) -> StdResult<Callback<CanonicalAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.canonize(api)? })
    }
}
impl Humanize<Callback<HumanAddr>> for Callback<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<Callback<HumanAddr>> {
        Ok(Callback { msg: self.msg.clone(), contract: self.contract.humanize(api)? })
    }
}

#[deprecated(note="Please use Callback<CanonicalAddr> instead.")]
pub type CallbackStored = Callback<CanonicalAddr>;

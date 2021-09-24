use crate::{
    scrt::{StdResult, Addr, CanonicalAddr, Api},
    scrt_addr::{Humanize, Canonize}
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub type CodeId   = u64;
pub type CodeHash = String;

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: CodeHash,
    pub id:        CodeId
}

/// Info needed to talk to a contract instance.
#[derive(Default, Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractLink<A> {
    pub address:   A,
    pub code_hash: CodeHash
}
impl Canonize<ContractLink<CanonicalAddr>> for ContractLink<Addr> {
    fn canonize (&self, api: &dyn Api) -> StdResult<ContractLink<CanonicalAddr>> {
        Ok(ContractLink {
            address:   self.address.canonize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}
impl Humanize<ContractLink<Addr>> for ContractLink<CanonicalAddr> {
    fn humanize (self, api: &dyn Api) -> StdResult<ContractLink<Addr>> {
        Ok(ContractLink {
            address:   self.address.humanize(api)?,
            code_hash: self.code_hash
        })
    }
}

#[deprecated(note="Please use the type ContractLink<A> instead")]
pub type ContractInstance<A> = ContractLink<A>;

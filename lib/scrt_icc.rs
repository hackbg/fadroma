use crate::{scrt::*, scrt_addr::*};
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
impl Canonize<ContractLink<CanonicalAddr>> for ContractLink<HumanAddr> {
    fn canonize (&self, api: &impl Api) -> StdResult<ContractLink<CanonicalAddr>> {
        Ok(ContractLink {
            address:   self.address.canonize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}
impl Humanize<ContractLink<HumanAddr>> for ContractLink<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<ContractLink<HumanAddr>> {
        Ok(ContractLink {
            address:   self.address.humanize(api)?,
            code_hash: self.code_hash.clone()
        })
    }
}

#[deprecated(note="Please use the type ContractLink<A> instead")]
pub type ContractInstance<A> = ContractLink<A>;

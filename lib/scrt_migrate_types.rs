use crate::{scrt::*, scrt_addr::*};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use fadroma_scrt_addr::{Humanize, Canonize};

/// Possible states of a contract.
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum ContractStatusLevel {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused,
    /// Permanently disabled
    Migrating,
}

// TODO once serde-json-wasm finally supports serializing Rusty enums,
// this structure can be merged with `ContractStatusLevel`, with
// `reason` and `new_address` becoming propeties of `Migrating`
/// Current state of a contract w/ optional description and pointer to new version
#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub struct ContractStatus<A> {
    pub level:       ContractStatusLevel,
    pub reason:      String,
    pub new_address: Option<A>
}
impl<A> Default for ContractStatus<A> {
    fn default () -> Self { Self {
        level:       ContractStatusLevel::Operational,
        reason:      String::new(),
        new_address: None
    } }
}
impl Humanize<ContractStatus<HumanAddr>> for ContractStatus<CanonicalAddr> {
    fn humanize (&self, api: &impl Api) -> StdResult<ContractStatus<HumanAddr>> {
        Ok(ContractStatus {
            level: self.level.clone(),
            reason: self.reason.clone(),
            new_address: match &self.new_address {
                Some(canon_addr) => Some(api.human_address(&canon_addr)?),
                None => None
            }
        })
    }
}
impl Canonize<ContractStatus<CanonicalAddr>> for ContractStatus<HumanAddr> {
    fn canonize (&self, api: &impl Api) -> StdResult<ContractStatus<CanonicalAddr>> {
        Ok(ContractStatus {
            level: self.level.clone(),
            reason: self.reason.clone(),
            new_address: match &self.new_address {
                Some(human_addr) => Some(api.canonical_address(&human_addr)?),
                None => None
            }
        })
    }
}

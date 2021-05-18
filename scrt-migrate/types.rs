use cosmwasm_std::{HumanAddr, CanonicalAddr, StdResult, Api};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use fadroma_scrt_addr::{Humanize, Canonize};

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum ContractStatusLevel {
    Operational,
    Paused,
    Migrating,
}

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
    fn humanize <A: Api> (&self, api: &A) -> StdResult<ContractStatus<HumanAddr>> {
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
    fn canonize <A: Api> (&self, api: &A) -> StdResult<ContractStatus<CanonicalAddr>> {
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

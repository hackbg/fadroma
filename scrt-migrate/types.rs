use cosmwasm_std::{HumanAddr, CanonicalAddr};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;

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
impl Humanize<ContractStatus<HumanAddr>> for ContractStatus<CanonicalAddr> {
    fn humanize <A: Api> (&self, api: &A) -> StdResult<ContractStatus<CanonicalAddr>> {
        Ok(ContractStatusLevel { ..self, new_address: match self.new_address {
            Some(canon_addr) => api.humanize(&canon_addr)?,
            None => None
        } })
    }
}
impl Canonize<ContractStatus<HumanAddr>> for ContractStatus<HumanAddr> {
    fn canonize <A: Api> (&self, api: &A) -> StdResult<ContractStatus<HumanAddr>> {
        Ok(ContractStatusLevel { ..self, new_address: match self.new_address {
            Some(human_addr) => api.canonize(&human_addr)?,
            None => None
        } })
    }
}

impl <A> ContractStatus <A> {
}

impl Default for ContractStatus {
    fn default () -> Self {
        Self {
            level:       ContractStatusLevel::Operational,
            reason:      String::new(),
            new_address: None
        }
    }
}

use cosmwasm_std::{HumanAddr, CanonicalAddr, StdResult, Api, Binary};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use crate::{humanize_maybe_empty, canonicalize_maybe_empty};

/// Code hash and address of a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInfo {
    pub code_hash: String,
    pub address: HumanAddr,
}
/// Code hash and address of a contract.
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct ContractInfoStored {
    pub code_hash: String,
    pub address: CanonicalAddr,
}

/// Info used to instantiate a contract
#[derive(Serialize, Deserialize, JsonSchema, Clone, PartialEq, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: String,
    pub id: u64
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
/// Used to ask a contract to send back a message.
pub struct Callback {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractInfo
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
/// Used to ask a contract to send back a message.
pub struct CallbackStored {
    /// The message to call.
    pub msg: Binary,
    /// Info about the contract requesting the callback.
    pub contract: ContractInfoStored
}

impl Default for ContractInfo {
    fn default() -> Self {
        ContractInfo {
            code_hash: "".into(),
            address: HumanAddr::default()
        }
    }
}

impl ContractInfo {
    pub fn to_stored(&self, api: &impl Api) -> StdResult<ContractInfoStored> {
        Ok(ContractInfoStored {
            code_hash: self.code_hash.clone(),
            address: canonicalize_maybe_empty(api, &self.address)?
        })
    }
}

impl ContractInfoStored {
    pub fn to_normal(self, api: &impl Api) -> StdResult<ContractInfo> {
        Ok(ContractInfo {
            code_hash: self.code_hash,
            address: humanize_maybe_empty(api, &self.address)?
        })
    }
}

impl Callback {
    pub fn to_stored(&self, api: &impl Api) -> StdResult<CallbackStored> {
        Ok(CallbackStored{
            msg: self.msg.clone(),
            contract: self.contract.to_stored(api)?
        })
    }
}

impl CallbackStored {
    pub fn to_normal(self, api: &impl Api) -> StdResult<Callback> {
        Ok(Callback{
            msg: self.msg.clone(),
            contract: self.contract.to_normal(api)?
        })
    }
}

use serde::{Deserialize, Serialize};

use crate::{
    self as fadroma,
    cosmwasm_std::{self, StdResult, Addr, Env, Api, WasmMsg, to_binary, Coin},
    impl_canonize_default,
    prelude::{Canonize, FadromaSerialize, FadromaDeserialize},
    schemars::{self, JsonSchema}
};
use super::addr::MaybeAddress;

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, JsonSchema, Clone, Debug)]
pub struct ContractCode {
    pub id: u64,
    pub code_hash: String
}

impl_canonize_default!(ContractCode);

// Disregard code hash because it is case insensitive.
// Converting to the same case first and the comparing is unnecessary
// as providing the wrong code hash when calling a contract will result
// in an error regardless and we have no way of checking that here.
impl PartialEq for ContractCode {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl ContractCode {
    #[inline]
    pub fn instantiate(
        self,
        label: impl Into<String>,
        msg: &impl Serialize,
        funds: Vec<Coin>
    ) -> StdResult<WasmMsg>
    {
        Ok(WasmMsg::Instantiate {
            code_id: self.id,
            code_hash: self.code_hash,
            label: label.into(),
            msg: to_binary(msg)?,
            funds,
            admin: None
        })
    }
}

/// Info needed to talk to a contract instance.
#[derive(Default, Serialize, Canonize, Deserialize, FadromaSerialize, FadromaDeserialize, JsonSchema, Clone, Debug)]
pub struct ContractLink<A: MaybeAddress> {
    pub address: A,
    pub code_hash: String
}

impl ContractLink<String> {
    #[inline]
    pub fn validate(self, api: &dyn Api) -> StdResult<ContractLink<Addr>> {
        Ok(ContractLink {
            address: api.addr_validate(&self.address)?,
            code_hash: self.code_hash
        })
    }
    
    #[inline]
    pub fn execute(self, msg: &impl Serialize, funds: Vec<Coin>) -> StdResult<WasmMsg> {
        Ok(WasmMsg::Execute {
            contract_addr: self.address,
            code_hash: self.code_hash,
            msg: to_binary(msg)?,
            funds
        })
    }
}

impl ContractLink<Addr> {
    #[inline]
    pub fn execute(self, msg: &impl Serialize, funds: Vec<Coin>) -> StdResult<WasmMsg> {
        Ok(WasmMsg::Execute {
            contract_addr: self.address.into_string(),
            code_hash: self.code_hash,
            msg: to_binary(msg)?,
            funds
        })
    }
}

// Disregard code hash because it is case insensitive.
// Converting to the same case first and the comparing is unnecessary
// as providing the wrong code hash when calling a contract will result
// in an error regardless and we have no way of checking that here.
impl<A: MaybeAddress + PartialEq> PartialEq for ContractLink<A> {
    fn eq(&self, other: &Self) -> bool {
        self.address == other.address
    }
}

impl From<&Env> for ContractLink<Addr> {
    fn from(env: &Env) -> ContractLink<Addr> {
        ContractLink {
            address: env.contract.address.clone(),
            code_hash: env.contract.code_hash.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq() {
        assert_eq!(
            ContractCode {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractCode {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_eq!(
            ContractCode {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractCode {
                id: 1,
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_ne!(
            ContractCode {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractCode {
                id: 2,
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_eq!(
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_eq!(
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_ne!(
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractLink {
                address: Addr::unchecked("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml5"),
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );
    }
}

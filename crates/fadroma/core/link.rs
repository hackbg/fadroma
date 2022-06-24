use crate::{
    cosmwasm_std::{self, StdResult, HumanAddr, CanonicalAddr, Api, Env},
    schemars::{self, JsonSchema},
    impl_canonize_default
};
use super::addr::{Humanize, Canonize};

use serde::{Deserialize, Serialize};

pub type CodeId   = u64;
pub type CodeHash = String;

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: CodeHash,
    pub id:        CodeId
}

impl_canonize_default!(ContractInstantiationInfo);

// Disregard code hash because it is case insensitive.
// Converting to the same case first and the comparing is unnecessary
// as providing the wrong code hash when calling a contract will result
// in an error regardless and we have no way of checking that here.
impl PartialEq for ContractInstantiationInfo {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

/// Info needed to talk to a contract instance.
#[derive(Default, Serialize, Deserialize, JsonSchema, Clone, Debug)]
pub struct ContractLink<A> {
    pub address:   A,
    pub code_hash: CodeHash
}

// Disregard code hash because it is case insensitive.
// Converting to the same case first and the comparing is unnecessary
// as providing the wrong code hash when calling a contract will result
// in an error regardless and we have no way of checking that here.
impl<A: PartialEq> PartialEq for ContractLink<A> {
    fn eq(&self, other: &Self) -> bool {
        self.address == other.address
    }
}

impl Humanize for ContractLink<CanonicalAddr> {
    type Output = ContractLink<HumanAddr>;

    fn humanize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(ContractLink {
            address: self.address.humanize(api)?,
            code_hash: self.code_hash
        })
    }
}

impl Canonize for ContractLink<HumanAddr> {
    type Output = ContractLink<CanonicalAddr>;

    fn canonize(self, api: &impl Api) -> StdResult<Self::Output> {
        Ok(ContractLink {
            address: self.address.canonize(api)?,
            code_hash: self.code_hash
        })
    }
}

impl From<Env> for ContractLink<HumanAddr> {
    fn from (env: Env) -> ContractLink<HumanAddr> {
        ContractLink {
            address:   env.contract.address,
            code_hash: env.contract_code_hash,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq() {
        assert_eq!(
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }, 
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );

        assert_eq!(
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }, 
            ContractInstantiationInfo {
                id: 1,
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );

        assert_ne!(
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }, 
            ContractInstantiationInfo {
                id: 2,
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );

        assert_eq!(
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            },
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );

        assert_eq!(
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            },
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );

        assert_ne!(
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4"),
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            },
            ContractLink {
                address: HumanAddr::from("secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml5"),
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084".into()
            }
        );
    }
}

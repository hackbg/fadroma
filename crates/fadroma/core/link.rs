use crate::{
    self as fadroma,
    cosmwasm_std::{self, StdResult, Addr, Env, Api},
    impl_canonize_default,
    prelude::{Canonize, Humanize},
    schemars::{self, JsonSchema},
};

use serde::{Deserialize, Serialize};

pub type CodeId = u64;
pub type CodeHash = String;

/// Info needed to instantiate a contract.
#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
pub struct ContractInstantiationInfo {
    pub code_hash: CodeHash,
    pub id: CodeId,
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
#[derive(Default, Serialize, Canonize, Deserialize, JsonSchema, Clone, Debug)]
pub struct ContractLink<A> {
    pub address: A,
    pub code_hash: CodeHash,
}

impl ContractLink<String> {
    #[inline]
    pub fn validate(self, api: &dyn Api) -> StdResult<ContractLink<Addr>> {
        Ok(ContractLink {
            address: api.addr_validate(&self.address)?,
            code_hash: self.code_hash
        })
    }
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

impl From<&Env> for ContractLink<Addr> {
    fn from(env: &Env) -> ContractLink<Addr> {
        ContractLink {
            address: env.contract.address.clone(),
            code_hash: env.contract.code_hash.clone(),
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
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_eq!(
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractInstantiationInfo {
                id: 1,
                code_hash: "C1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            }
        );

        assert_ne!(
            ContractInstantiationInfo {
                id: 1,
                code_hash: "c1dc8261059fee1de9f1873cd1359ccd7a6bc5623772661fa3d55332eb652084"
                    .into()
            },
            ContractInstantiationInfo {
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

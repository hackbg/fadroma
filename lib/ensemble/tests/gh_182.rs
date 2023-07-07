#![allow(unused)]

//! https://github.com/hackbg/fadroma/issues/182
//!
//! > I have a fairly complex operation which when I execute it in Contract A, will instantiate two Contracts B & C.
//! > Contract C relies on B. So Contract A will wait for the reply of the Contract B instantiation.
//! > Then from the reply it will launch another submessage to instantiate Contract C.
//! > Contract A then waits for the reply of Contract C.
//! > Finally Contract A will return a response after Contract C replies with the addresses of both Contract B & C.
//! > The data set by Contract A from the final reply from Contract C is not being returned in the response in Ensemble:
//! > [screenshot omitted]
//! > It is picking the wrong index and setting the data of state[1] when I think it should be overwriting the data in state[0]

use serde::{Deserialize, Serialize};
use crate::{prelude::*, ensemble::*};

#[test] fn test_gh_182 () {
    let mut ensemble = ContractEnsemble::new();
    let env = MockEnv::new("admin", "contract_a");
    // "Upload" the 3 contracts
    let contract_a = ensemble.register(Box::new(ContractA));
    let contract_b = ensemble.register(Box::new(ContractB));
    let contract_c = ensemble.register(Box::new(ContractC));
    // Instantiate contract A with the code ids of contracts B and C
    let init = ContractAInit { code_id_b: contract_b.id, code_id_c: contract_c.id };
    let contract_a = ensemble.instantiate(contract_a.id, &init, env.clone()).unwrap().instance;
    // Execute a transaction that instantiates contracts B and C
    let response = ensemble.execute(&ContractAExec::InstantiateBC {}, env.clone()).unwrap();
    //assert_eq!(response.response.messages, vec![]);
    println!("Final response: {:#?}", response);
    assert_eq!(response.response.attributes, vec![
        Attribute::new("address_b", "contract_b"),
        Attribute::new("address_c", "contract_c"),
    ]);
}

type CodeId = u64;

macro_rules! storage {
    ($name:ident, $ty:ty, $ns:ident, $prefix:literal) => {
        crate::namespace!($ns, $prefix);
        const $name: SingleItem<$ty, $ns> = SingleItem::new();
    }
}

storage!(CODE_ID_B, CodeId, CodeIdB,  b"code_id_b");
storage!(CODE_ID_C, CodeId, CodeIdC,  b"code_id_c");
storage!(ADDRESS_B, String, AddressB, b"address_b");

struct ContractA;

#[derive(Serialize, Deserialize)]
struct ContractAInit {
    code_id_b: CodeId,
    code_id_c: CodeId
}

#[derive(Serialize, Deserialize)]
enum ContractAExec {
    InstantiateBC {}
}

struct ContractB;

struct ContractC;

#[derive(Serialize, Deserialize)]
struct ContractCInit {
    address_b: Addr
}

impl ContractHarness for ContractA {
    fn instantiate (&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary)
        -> AnyResult<Response>
    {
        let ContractAInit { ref code_id_b, ref code_id_c } = from_binary(&msg)?;
        CODE_ID_B.save(deps.storage, code_id_b)?;
        CODE_ID_C.save(deps.storage, code_id_c)?;
        Ok(Response::default())
    }
    fn execute (&self, deps: DepsMut, _: Env, _: MessageInfo, msg: Binary)
        -> AnyResult<Response>
    {
        Ok(match from_binary::<ContractAExec>(&msg)? {
            ContractAExec::InstantiateBC {} => Response::default()
                .add_submessage(SubMsg::reply_on_success(WasmMsg::Instantiate {
                    code_id:   CODE_ID_B.load(deps.storage)?.unwrap(),
                    code_hash: "test_contract_1".to_string(),
                    funds:     vec![],
                    label:     "contract_b".to_string(),
                    msg:       to_binary("{}")?
                }, 0))
        })
    }
    fn reply (&self, deps: DepsMut, _: Env, reply: Reply) -> AnyResult<Response> {
        Ok(match reply.id {
            0 => {
                let address_b = &reply.result.unwrap().events[0].attributes[0].value;
                ADDRESS_B.save(deps.storage, address_b)?;
                let address_b = deps.api.addr_validate(address_b)?;
                Response::default()
                    .add_submessage(SubMsg::reply_on_success(WasmMsg::Instantiate {
                        code_id:   CODE_ID_C.load(deps.storage)?.unwrap(),
                        code_hash: "test_contract_2".to_string(),
                        funds:     vec![],
                        label:     "contract_c".to_string(),
                        msg:       to_binary(&ContractCInit { address_b })?
                    }, 1))
            },
            1 => {
                let address_b = ADDRESS_B.load(deps.storage)?.unwrap();
                let address_c = &reply.result.unwrap().events[0].attributes[0].value;
                Response::default()
                    .add_attributes(vec![
                        ("address_b", address_b),
                        ("address_c", address_c.clone()),
                    ])
            },
            _ => unreachable!()
        })
    }
}

impl ContractHarness for ContractB {
    fn instantiate(&self, _: DepsMut, _: Env, _: MessageInfo, _: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
}

impl ContractHarness for ContractC {
    fn instantiate(&self, _: DepsMut, _: Env, _: MessageInfo, _: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
}

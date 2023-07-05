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
    let contract_a = ensemble.register(Box::new(ContractA));
    let contract_b = ensemble.register(Box::new(ContractB));
    let contract_c = ensemble.register(Box::new(ContractC));
    let contract_a = ensemble
        .instantiate(contract_a.id, &ContractAInit {
            code_id_b: contract_b.id,
            code_id_c: contract_c.id,
        }, env.clone())
        .unwrap()
        .instance;
    let response = ensemble
        .execute(&ContractAExec::InstantiateBC {}, env.clone())
        .unwrap();
    unimplemented!();
}

type CodeId = u64;

macro_rules! storage {
    ($name:ident, $ty:ty, $ns:ident, $prefix:literal) => {
        crate::namespace!($ns, $prefix);
        const $name: SingleItem<$ty, $ns> = SingleItem::new();
    }
}

storage!(CODE_ID_B, CodeId, CodeIdB, b"code_id_b_");

storage!(CODE_ID_C, CodeId, CodeIdC, b"code_id_c_");

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
    contract_b_address: CanonicalAddr
}

impl ContractHarness for ContractA {
    fn instantiate (&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let ContractAInit { ref code_id_b, ref code_id_c } = from_binary(&msg)?;
        CODE_ID_B.save(deps.storage, code_id_b)?;
        CODE_ID_C.save(deps.storage, code_id_c)?;
        Ok(Response::default())
    }
    fn execute (&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        Ok(match from_binary::<ContractAExec>(&msg)? {
            ContractAExec::InstantiateBC {} => {
                Response::default()
                    .add_submessage(SubMsg::new(CosmosMsg::Wasm(WasmMsg::Instantiate {
                        code_id: CODE_ID_B.load(deps.storage)?.unwrap(),
                        code_hash: "".to_string(),
                        funds: vec![],
                        label: "contract_b".to_string(),
                        msg:   to_binary("{}")?
                    })))
            }
        })
    }
    fn query (&self, _deps: Deps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

impl ContractHarness for ContractB {
    fn instantiate(&self, _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
    fn execute(&self, _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        unreachable!();
    }
    fn query (&self, _deps: Deps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

impl ContractHarness for ContractC {
    fn instantiate(&self, _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }
    fn execute(&self, _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        unreachable!();
    }
    fn query (&self, _deps: Deps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        unreachable!();
    }
}

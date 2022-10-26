use serde::{Deserialize, Serialize};

use crate::ensemble::{
    ContractEnsemble, ContractHarness,
    MockEnv, AnyResult,
    anyhow::{bail, anyhow}
};
use crate::prelude::*;

const SENDER: &str = "sender";
const A_ADDR: &str = "A";
const B_ADDR: &str = "B";

struct Contract;

#[derive(Serialize, Deserialize)]
enum ExecuteMsg {
    RunMsgs(Vec<SubMsg>),
    SetNumber(u32),
    Fail
}

impl ContractHarness for Contract {
    fn instantiate(&self, _deps: DepsMut, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }

    fn execute(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;

        execute(deps, msg)
    }

    fn query(&self, deps: Deps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        query(deps)
    }

    fn reply(&self, _deps: DepsMut, _env: Env, _reply: Reply) -> AnyResult<Response> {
        Ok(Response::default())
    }
}

fn execute(deps: DepsMut, msg: ExecuteMsg) -> AnyResult<Response> {
    let mut resp = Response::default();

    match msg {
        ExecuteMsg::RunMsgs(msgs) => { resp = resp.add_submessages(msgs); },
        ExecuteMsg::SetNumber(num) => {
            save(deps.storage, b"num", &num)?;
        },
        ExecuteMsg::Fail => bail!(StdError::generic_err("Fail"))
    }

    Ok(resp)
}

fn query(deps: Deps) -> AnyResult<Binary> {
    let num: u32 = load(deps.storage, b"num")?.unwrap_or_default();

    to_binary(&num).map_err(|x| anyhow!(x)) 
}

#[test]
fn correct_message_order() {
    let (mut ensemble, a, _) = init();

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::new(a_msg(&ExecuteMsg::SetNumber(1)))
                ])
            ),
            0
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::SetNumber(2)), 1),
        SubMsg::new(b_msg(&ExecuteMsg::SetNumber(3)))
    ]);

    // https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#order-and-rollback

    // Contract A returns submessages S1 and S2, and message M1.
    // Submessage S1 returns message N1.
    // The order will be: S1, N1, reply(S1), S2, reply(S2), M1

    let resp = ensemble.execute(&msg, MockEnv::new(SENDER, a.address)).unwrap();
    let mut resp = resp.iter();

    assert!(resp.next().unwrap().is_execute()); // S1
    assert!(resp.next().unwrap().is_execute()); // N1
    assert!(resp.next().unwrap().is_reply()); // reply(S1)
    assert!(resp.next().unwrap().is_execute()); // S2
    assert!(resp.next().unwrap().is_reply()); // reply(S2)
    assert!(resp.next().unwrap().is_execute()); //M1
}

#[test]
fn reverts_balance_to_caller_on_submsg_failure() {
    
}

#[test]
fn reverts_balance_to_sender_on_submsg_success_but_err_in_reply() {
    
}

#[test]
fn instantiate_child_err_handled_in_reply() {
    
}

fn init() -> (ContractEnsemble, ContractLink<Addr>, ContractLink<Addr>) {
    let mut ensemble = ContractEnsemble::new();

    let contract = ensemble.register(Box::new(Contract));

    let a = ensemble.instantiate(contract.clone(), &(), MockEnv::new(SENDER, A_ADDR)).unwrap();
    let b = ensemble.instantiate(contract, &(), MockEnv::new(SENDER, B_ADDR)).unwrap();

    (ensemble, a.instance, b.instance)
}

fn a_msg(msg: &ExecuteMsg) -> WasmMsg {
    WasmMsg::Execute {
        contract_addr: A_ADDR.into(),
        code_hash: "test_contract_0".into(),
        msg: to_binary(msg).unwrap(),
        funds: vec![]
    }
}

fn b_msg(msg: &ExecuteMsg) -> WasmMsg {
    WasmMsg::Execute {
        contract_addr: B_ADDR.into(),
        code_hash: "test_contract_0".into(),
        msg: to_binary(msg).unwrap(),
        funds: vec![]
    }
}

use serde::{Deserialize, Serialize};

use crate::ensemble::{
    ContractEnsemble, ContractHarness, MockDeps,
    MockEnv, AnyResult,
    anyhow::{bail, anyhow}
};
use crate::prelude::*;

const SENDER: &str = "sender";
const A_ADDR: &str = "A";
const B_ADDR: &str = "B";

struct A;
struct B;

#[derive(Serialize, Deserialize)]
enum ExecuteMsg {
    RunMsgs(Vec<SubMsg>),
    SetNumber(u32),
    Fail
}

impl ContractHarness for A {
    fn instantiate(&self, _deps: &mut MockDeps, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }

    fn execute(&self, deps: &mut MockDeps, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;

        execute(deps.as_mut(), msg)
    }

    fn query(&self, deps: &MockDeps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        query(deps.as_ref())
    }
}

impl ContractHarness for B {
    fn instantiate(&self, _deps: &mut MockDeps, _env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        Ok(Response::default())
    }

    fn execute(&self, deps: &mut MockDeps, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;

        execute(deps.as_mut(), msg)
    }

    fn query(&self, deps: &MockDeps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        query(deps.as_ref())
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
    // https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#order-and-rollback

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

    let resp = ensemble.execute(&msg, MockEnv::new(SENDER, a.address)).unwrap();
    let mut resp = resp.iter();

    assert!(resp.next().unwrap().is_execute());
    assert!(resp.next().unwrap().is_execute());
    assert!(resp.next().unwrap().is_reply());
    assert!(resp.next().unwrap().is_execute());
    assert!(resp.next().unwrap().is_reply());
    assert!(resp.next().unwrap().is_execute());
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

    let a = ensemble.register(Box::new(A));
    let b = ensemble.register(Box::new(B));

    let a = ensemble.instantiate(a, &(), MockEnv::new(SENDER, A_ADDR)).unwrap();
    let b = ensemble.instantiate(b, &(), MockEnv::new(SENDER, B_ADDR)).unwrap();

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
        code_hash: "test_contract_1".into(),
        msg: to_binary(msg).unwrap(),
        funds: vec![]
    }
}

use serde::{Deserialize, Serialize};

use crate::ensemble::{
    ContractEnsemble, ContractHarness,
    MockEnv, AnyResult,
    anyhow::{bail, anyhow},
    response::ResponseVariants
};
use crate::prelude::*;

const SENDER: &str = "sender";
const A_ADDR: &str = "A";
const B_ADDR: &str = "B";
const C_ADDR: &str = "C";

const EVENT_TYPE: &str = "MSG_ORDER";

struct Contract;

#[derive(Serialize, Deserialize)]
struct InstantiateMsg {
    reply_fail_id: Option<u64>
}

#[derive(Serialize, Deserialize)]
enum ExecuteMsg {
    RunMsgs(Vec<SubMsg>),
    IncrNumber(u32),
    Fail
}

#[derive(Serialize, Deserialize)]
struct QueryResponse {
    num: u32,
    balance: Coin
}

impl ContractHarness for Contract {
    fn instantiate(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: InstantiateMsg = from_binary(&msg)?;

        if let Some(id) = msg.reply_fail_id {
            save(deps.storage, b"fail", &id)?;
        }

        Ok(Response::default())
    }

    fn execute(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;
        let mut resp = Response::default();

        match msg {
            ExecuteMsg::RunMsgs(msgs) => { resp = resp.add_submessages(msgs); },
            ExecuteMsg::IncrNumber(amount) => {
                let mut num: u32 = load(deps.storage, b"num")?.unwrap_or_default();
                num += amount;

                save(deps.storage, b"num", &num)?;

                if num > 10 {
                    bail!(StdError::generic_err("Number is bigger than 10."));
                }
            },
            ExecuteMsg::Fail => bail!(StdError::generic_err("Fail"))
        }
    
        Ok(resp)
    }

    fn query(&self, deps: Deps, env: Env, _msg: Binary) -> AnyResult<Binary> {
        let num: u32 = load(deps.storage, b"num")?.unwrap_or_default();
        let balance = deps.querier.query_balance(env.contract.address, "uscrt")?;

        let resp = QueryResponse {
            num,
            balance
        };

        to_binary(&resp).map_err(|x| anyhow!(x)) 
    }

    fn reply(&self, deps: DepsMut, env: Env, reply: Reply) -> AnyResult<Response> {
        let fail_id: Option<u64> = load(deps.storage, b"fail")?;

        if let Some(id) = fail_id {
            if id == reply.id {
                bail!(StdError::generic_err("Failed in reply."))
            }
        }

        Ok(Response::default().add_event(
            Event::new(EVENT_TYPE)
                .add_attribute(
                    "submsg_reply",
                    format!(
                        "address: {}, id: {}, success: {}",
                        env.contract.address,
                        reply.id,
                        reply.result.is_ok()
                    )
                )
        ))
    }
}

struct TestContracts {
    ensemble: ContractEnsemble,
    a: ContractLink<Addr>,
    b: ContractLink<Addr>,
    c: ContractLink<Addr>
}

impl TestContracts {
    fn a_state(&self) -> QueryResponse {
        let state = self.ensemble.query(&self.a.address, &()).unwrap();

        state
    }

    fn b_state(&self) -> QueryResponse {
        let state = self.ensemble.query(&self.b.address, &()).unwrap();

        state
    }

    fn c_state(&self) -> QueryResponse {
        let state = self.ensemble.query(&self.c.address, &()).unwrap();

        state
    }
}

#[test]
fn correct_message_order() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::new(a_msg(&ExecuteMsg::IncrNumber(1)))
                ])
            ),
            0
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 1),
        SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    // https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#order-and-rollback

    // Contract A returns submessages S1 and S2, and message M1.
    // Submessage S1 returns message N1.
    // The order will be: S1, N1, reply(S1), S2, reply(S2), M1

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute()); // S1

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute()); // N1

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply()); // reply(S1)

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute()); // S2

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply()); // reply(S2)

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute()); //M1

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 1);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 3);
}

#[test]
fn replies_chain_correctly() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(a_msg(&ExecuteMsg::IncrNumber(1)), 0)
                ])
            ),
            1
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 2),
        SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 2);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 1);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 3);
}

#[test]
fn reverts_state_when_a_single_message_in_a_submsg_chain_fails() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(1))),
                    SubMsg::new(c_msg(&ExecuteMsg::Fail))
                ])
            ),
            0
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 1)
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    // reply(A) - ID: 0 - notice that even though it was successful,
    // the first sub-message is not included because all state was reverted
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 0);
}

#[test]
fn only_successful_submsg_state_is_committed() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(12)), 1) // This will fail
                ])
            ),
            2
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(2)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 2);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 1);
}

#[test]
fn reverts_state_when_reply_in_submsg_fails() {
    let mut c = init([None, Some(1), None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 1),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 2),
                ])
            ),
            3
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 4)
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 3);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 4);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 0);
}

#[test]
fn reply_err_in_root_level_fails_tx() {
    let mut c = init([Some(2), None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::Fail), 1),
                ])
            ),
            2
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 3),
        SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(5)))
    ]);

    let err = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap_err();
    assert_eq!(err.to_string(), "Generic error: Failed in reply.");

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 0);

    let state = c.c_state();
    assert_eq!(state.num, 0);
}

#[test]
fn errors_are_handled_in_submsg_reply_state_is_committed() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::new(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::Fail), 1),
                ])
            )
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 3);

    let state = c.c_state();
    assert_eq!(state.num, 1);
}

#[test]
fn errors_in_middle_of_submsg_scope_are_handled_and_execution_continues() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::new(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::Fail), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 1)
                ])
            )
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 0);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 1);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 3);

    let state = c.c_state();
    assert_eq!(state.num, 1);
}

#[test]
fn unhandled_error_in_submsg_is_bubbled_up_to_the_caller() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::new(c_msg(&ExecuteMsg::Fail)),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 1),
                ])
            ),
            2
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 2);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 3);

    let state = c.c_state();
    assert_eq!(state.num, 0);
}

#[test]
fn unhandled_error_in_nested_message_fails_tx() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::new(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::new(c_msg(&ExecuteMsg::Fail))
                ])
            )
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let err = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap_err();
    assert_eq!(err.to_string(), "Generic error: Fail");

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 0);

    let state = c.c_state();
    assert_eq!(state.num, 0);
}

#[test]
fn unhandled_error_jumps_to_the_first_reply() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_on_success(
                        c_msg(
                            &ExecuteMsg::RunMsgs(vec![
                                SubMsg::reply_on_success(a_msg(&ExecuteMsg::IncrNumber(1)), 0),
                                SubMsg::new(b_msg(&ExecuteMsg::Fail))
                            ])
                        ),
                        1
                    ),
                    SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(1)))
                ])
            ),
            2
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(2)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 2);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.sender, A_ADDR);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 0);
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

fn init(msgs: [Option<u64>; 3]) -> TestContracts {
    let mut ensemble = ContractEnsemble::new_with_denom("uscrt");
    let contract = ensemble.register(Box::new(Contract));

    let a = ensemble.instantiate(
        contract.clone(),
        &InstantiateMsg {
            reply_fail_id: msgs[0]
        },
        MockEnv::new(SENDER, A_ADDR)
    ).unwrap();

    let b = ensemble.instantiate(
        contract.clone(),
        &InstantiateMsg {
            reply_fail_id: msgs[1]
        },
        MockEnv::new(SENDER, B_ADDR)
    ).unwrap();

    let c = ensemble.instantiate(
        contract.clone(),
        &InstantiateMsg {
            reply_fail_id: msgs[2]
        },
        MockEnv::new(SENDER, C_ADDR)
    ).unwrap();

    TestContracts {
        ensemble,
        a: a.instance,
        b: b.instance,
        c: c.instance
    }
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

fn c_msg(msg: &ExecuteMsg) -> WasmMsg {
    WasmMsg::Execute {
        contract_addr: C_ADDR.into(),
        code_hash: "test_contract_0".into(),
        msg: to_binary(msg).unwrap(),
        funds: vec![]
    }
}

fn a_msg_funds(msg: &ExecuteMsg, coin: Coin) -> WasmMsg {
    let mut msg = a_msg(msg);
    push_funds(&mut msg, coin);

    msg
}

fn b_msg_funds(msg: &ExecuteMsg, coin: Coin) -> WasmMsg {
    let mut msg = b_msg(msg);
    push_funds(&mut msg, coin);

    msg
}

fn c_msg_funds(msg: &ExecuteMsg, coin: Coin) -> WasmMsg {
    let mut msg = c_msg(msg);
    push_funds(&mut msg, coin);

    msg
}

fn push_funds(msg: &mut WasmMsg, coin: Coin) {
    match msg {
        WasmMsg::Execute { funds, .. } => funds.push(coin),
        WasmMsg::Instantiate { funds, .. } => funds.push(coin),
        _ => unreachable!()
    }
}

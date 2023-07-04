use serde::{Deserialize, Serialize};

use crate::{
    bin_serde::adapter::SerdeAdapter,
    storage::{SingleItem, ItemSpace, TypedKey},
    ensemble::{
        ContractEnsemble, ContractHarness,
        MockEnv, AnyResult,
        anyhow::{bail, anyhow},
        response::ResponseVariants, EnsembleResult
    }
};
use crate::prelude::*;

const SENDER: &str = "sender";
const A_ADDR: &str = "a";
const B_ADDR: &str = "b";
const C_ADDR: &str = "c";

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
    IncrAndSend {
        amount: u32,
        recipient: String
    },
    Fail,
    ReplyResponse(SubMsg),
    ReplyData {
        id: u64,
        data: Binary
    }
}

#[derive(Serialize, Deserialize)]
enum QueryMsg {
    State,
    Reply(u64)
}

#[derive(Serialize, Deserialize)]
struct StateResponse {
    num: u32,
    balance: Coin
}

crate::namespace!(ReplyDataNs, b"reply_data_");
const REPLY_DATA: ItemSpace<Binary, ReplyDataNs, TypedKey<u64>> = ItemSpace::new();

crate::namespace!(ReplyNs, b"reply");
const REPLY_RESP: SingleItem<SerdeAdapter<SubMsg>, ReplyNs> = SingleItem::new();
const REPLIES: ItemSpace<SerdeAdapter<SubMsgResponse>, ReplyNs, TypedKey<u64>> = ItemSpace::new();

impl ContractHarness for Contract {
    fn instantiate(&self, deps: DepsMut, _env: Env, _info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: InstantiateMsg = from_binary(&msg)?;

        if let Some(id) = msg.reply_fail_id {
            storage::save(deps.storage, b"fail", &id)?;
        }

        Ok(Response::default().add_attribute("INSTANTIATE", "test"))
    }

    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
        let msg: ExecuteMsg = from_binary(&msg)?;
        let mut resp = Response::default()
            .add_attribute("TEST_ATTR", "test")
            .add_attribute("ANOTHER_TEST_ATTR", "test")
            .add_event(
                Event::new(EVENT_TYPE).add_attribute(
                    "submsg_execute",
                    format!("sender: {}\ncontract: {}", info.sender, env.contract.address)
                )
            );
     
        match msg {
            ExecuteMsg::RunMsgs(msgs) => { resp = resp.add_submessages(msgs); }
            ExecuteMsg::IncrNumber(amount) => {
                resp.data = Some(increment_data(amount));
                increment(deps.storage, amount)?;
            }
            ExecuteMsg::IncrAndSend { amount, recipient } => {
                increment(deps.storage, amount)?;

                resp = resp.add_message(BankMsg::Send {
                    to_address: recipient,
                    amount: vec![coin(100, "uscrt")]
                })
            }
            ExecuteMsg::ReplyResponse(msg) => {
                REPLY_RESP.save(deps.storage, &msg.into())?;
            }
            ExecuteMsg::ReplyData { id, data } => {
                REPLY_DATA.save(deps.storage, &id, &data)?;
            }
            ExecuteMsg::Fail => bail!(StdError::generic_err("Fail"))
        }
    
        Ok(resp)
    }

    fn query(&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary> {
        let msg: QueryMsg = from_binary(&msg)?;

        let result = match msg {
            QueryMsg::State => {
                let num: u32 = storage::load(deps.storage, b"num")?.unwrap_or_default();
                let balance = deps.querier.query_balance(env.contract.address, "uscrt")?;
        
                let resp = StateResponse {
                    num,
                    balance
                };
        
                to_binary(&resp)
            },
            QueryMsg::Reply(id) => {
                let resp = REPLIES.load(deps.storage, &id)?;

                if let Some(resp) = resp {
                    to_binary(&resp.0)
                } else {
                    bail!(no_reply_stored_err(id))
                }
            }
        };

        result.map_err(|x| anyhow!(x))
    }

    fn reply(&self, deps: DepsMut, env: Env, reply: Reply) -> AnyResult<Response> {
        let fail_id: Option<u64> = storage::load(deps.storage, b"fail")?;

        if let Some(id) = fail_id {
            if id == reply.id {
                bail!(StdError::generic_err("Failed in reply."))
            }
        }

        let result_ok = reply.result.is_ok();
        if let SubMsgResult::Ok(resp) = reply.result {
            REPLIES.save(deps.storage, &reply.id, &resp.into())?;
        }

        let mut response = Response::default().add_event(
            Event::new(EVENT_TYPE)
                .add_attribute(
                    "submsg_reply",
                    format!(
                        "address: {}, id: {}, success: {}",
                        env.contract.address,
                        reply.id,
                        result_ok
                    )
                )
        );

        if let Some(msg) = REPLY_RESP.load(deps.storage)? {
            response.messages.push(msg.0);
            REPLY_RESP.remove(deps.storage);
        }

        if let Some(data) = REPLY_DATA.load(deps.storage, &reply.id)? {
            response.data = Some(data);
        }

        Ok(response)
    }
}

fn increment(storage: &mut dyn Storage, amount: u32) -> StdResult<()> {
    let mut num: u32 = storage::load(storage, b"num")?.unwrap_or_default();
    num += amount;

    storage::save(storage, b"num", &num)?;

    if num > 10 {
        Err(StdError::generic_err("Number is bigger than 10."))
    } else {
        Ok(())
    }
}

fn no_reply_stored_err(id: u64) -> StdError {
    StdError::generic_err(format!("No reply response for id {}", id))
}

fn increment_data(amount: u32) -> Binary {
    Binary::from(format!("Increment amount: {}", amount).as_bytes())
}

fn reply_data(id: u64) -> Binary {
    Binary::from(format!("Overwrite data in reply for id: {}", id).as_bytes())
}

struct TestContracts {
    ensemble: ContractEnsemble,
    a: ContractLink<Addr>,
    b: ContractLink<Addr>,
    c: ContractLink<Addr>
}

impl TestContracts {
    fn a_state(&self) -> StateResponse {
        self.ensemble.query(&self.a.address, &QueryMsg::State).unwrap()
    }

    fn b_state(&self) -> StateResponse {
        self.ensemble.query(&self.b.address, &QueryMsg::State).unwrap()
    }

    fn c_state(&self) -> StateResponse {
        self.ensemble.query(&self.c.address, &QueryMsg::State).unwrap()
    }

    fn a_events(&self, id: u64) -> EnsembleResult<SubMsgResponse> {
        self.ensemble.query(&self.a.address, &QueryMsg::Reply(id))
    }

    fn b_events(&self, id: u64) -> EnsembleResult<SubMsgResponse> {
        self.ensemble.query(&self.b.address, &QueryMsg::Reply(id))
    }

    fn c_events(&self, id: u64) -> EnsembleResult<SubMsgResponse> {
        self.ensemble.query(&self.c.address, &QueryMsg::Reply(id))
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

    c.ensemble.execute(
        &ExecuteMsg::ReplyData { id: 1, data: reply_data(1) },
        MockEnv::new(SENDER, c.b.address.clone())
    ).unwrap();

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

    cmp_response_json(
        &c.b_events(0).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.a_events(1).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 0, success: true\",\"encrypted\":true}]}],\"data\":null}"
    );

    cmp_response_json(
        &c.a_events(2).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMg==\"}"
    );

    assert_eq!(
        c.a_events(3).unwrap_err().to_string(),
        no_reply_stored_err(3).to_string()
    )
}

#[test]
fn last_data_from_reply_is_passed_to_caller() {
    let mut c = init([None, None, None]);

    c.ensemble.execute(
        &ExecuteMsg::ReplyData { id: 0, data: reply_data(0) },
        MockEnv::new(SENDER, c.b.address.clone())
    ).unwrap();

    c.ensemble.execute(
        &ExecuteMsg::ReplyData { id: 1, data: reply_data(1) },
        MockEnv::new(SENDER, c.b.address.clone())
    ).unwrap();

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(a_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(2)), 1)
                ])
            ),
            2
        )
    ]);

    c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();

    cmp_response_json(
        &c.b_events(0).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.b_events(1).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMg==\"}"
    );

    cmp_response_json(
        &c.a_events(2).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 0, success: true\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 1, success: true\",\"encrypted\":true}]}],\"data\":\"T3ZlcndyaXRlIGRhdGEgaW4gcmVwbHkgZm9yIGlkOiAx\"}"
    );
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

    cmp_response_json(
        &c.b_events(0).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    assert_eq!(
        c.b_events(1).unwrap_err().to_string(),
        no_reply_stored_err(1).to_string()
    );

    cmp_response_json(
        &c.a_events(2).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 0, success: true\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 1, success: false\",\"encrypted\":true}]}],\"data\":null}"
    );
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
    c.ensemble.add_funds(C_ADDR, vec![coin(200, "uscrt")]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(
                        c_msg(&ExecuteMsg::IncrAndSend {
                            amount: 1, recipient: A_ADDR.into()
                        }),
                        0
                    ),
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
    assert_eq!(state.balance.amount.u128(), 0);

    let state = c.b_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 0);

    let state = c.c_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 200);
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
    c.ensemble.add_funds(C_ADDR, vec![coin(200, "uscrt")]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(
                        c_msg(&ExecuteMsg::IncrAndSend {
                            amount: 1,
                            recipient: A_ADDR.into()
                        }),
                        0
                    ),
                    SubMsg::new(c_msg(&ExecuteMsg::Fail)),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 1),
                ])
            ),
            2
        ),
        SubMsg::new(
            c_msg(&ExecuteMsg::IncrAndSend {
                amount: 3,
                recipient: B_ADDR.into()
            })
        ),
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

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

    let next = resp.next().unwrap();
    assert!(next.is_bank());

    if let ResponseVariants::Bank(resp) = next {
        assert_eq!(resp.receiver, B_ADDR);
        assert_eq!(resp.sender, C_ADDR);
        assert_eq!(resp.coins, vec![coin(100, "uscrt")]);
    }

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 0);

    let state = c.b_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 100);

    let state = c.c_state();
    assert_eq!(state.num, 3);
    assert_eq!(state.balance.amount.u128(), 100);
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
fn error_bubbles_multiple_levels_up_the_stack() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_on_error(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::new(c_msg(&ExecuteMsg::RunMsgs(vec![
                        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(1))),
                        SubMsg::reply_on_success(a_msg(
                            &ExecuteMsg::RunMsgs(vec![
                                SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(15))) // This will fail
                            ])
                        ),
                        1),
                    ]))),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 2),
                ])
            ),
            3
        ),
        SubMsg::new(b_msg(&ExecuteMsg::IncrNumber(3)))
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

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

    assert_eq!(resp.next(), None);

    let state = c.a_state();
    assert_eq!(state.num, 0);

    let state = c.b_state();
    assert_eq!(state.num, 3);

    let state = c.c_state();
    assert_eq!(state.num, 0);

    assert_eq!(
        c.b_events(0).unwrap_err().to_string(),
        no_reply_stored_err(0).to_string()
    );

    assert_eq!(
        c.c_events(1).unwrap_err().to_string(),
        no_reply_stored_err(1).to_string()
    );

    assert_eq!(
        c.b_events(2).unwrap_err().to_string(),
        no_reply_stored_err(2).to_string()
    );

    assert_eq!(
        c.a_events(3).unwrap_err().to_string(),
        no_reply_stored_err(3).to_string()
    );
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

    assert_eq!(
        c.c_events(0).unwrap_err().to_string(),
        no_reply_stored_err(0).to_string()
    );

    assert_eq!(
        c.b_events(1).unwrap_err().to_string(),
        no_reply_stored_err(1).to_string()
    );

    assert_eq!(
        c.a_events(2).unwrap_err().to_string(),
        no_reply_stored_err(2).to_string()
    );
}

#[test]
fn reply_responses_are_handled_correctly() {
    let mut c = init([None, None, None]);

    let msg = ExecuteMsg::ReplyResponse(
        SubMsg::reply_always(
            a_msg(&ExecuteMsg::IncrNumber(1)),
            2
        )
    );

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.b.address.clone())).unwrap();
    assert!(resp.sent.is_empty());
    assert_eq!(resp.address, B_ADDR);
    assert_eq!(resp.sender, SENDER);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_on_success(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::reply_on_success(c_msg(&ExecuteMsg::IncrNumber(1)), 1),
                ])
            ),
            3
        ),
        SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(3))),
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
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.sender, B_ADDR);
    }

    let next = resp.next().unwrap();
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, B_ADDR);
        assert_eq!(resp.reply.id, 2);
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
    assert!(next.is_reply());

    if let ResponseVariants::Reply(resp) = next {
        assert_eq!(resp.address, A_ADDR);
        assert_eq!(resp.reply.id, 3);
    }

    let next = resp.next().unwrap();
    assert!(next.is_execute());

    if let ResponseVariants::Execute(resp) = next {
        assert_eq!(resp.address, C_ADDR);
        assert_eq!(resp.sender, A_ADDR);
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
    assert_eq!(state.num, 1);

    let state = c.b_state();
    assert_eq!(state.num, 2);

    let state = c.c_state();
    assert_eq!(state.num, 5);

    cmp_response_json(
        &c.b_events(0).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.b_events(1).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.b_events(2).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.a_events(3).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 0, success: true\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: a\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 2, success: true\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 1, success: true\",\"encrypted\":true}]}],\"data\":null}"
    );

    cmp_response_json(
        &c.a_events(4).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMg==\"}"
    );
}

#[test]
fn reply_response_error_is_handled_properly() {
    let mut c = init([None, Some(2), None]);

    let msg = ExecuteMsg::ReplyResponse(
        SubMsg::reply_always(
            a_msg(&ExecuteMsg::RunMsgs(vec![
                SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(1))),
                SubMsg::reply_on_success(b_msg(&ExecuteMsg::IncrNumber(20)), 1) // This will fail
            ])),
            2
        )
    );

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.b.address.clone())).unwrap();
    assert!(resp.sent.is_empty());
    assert_eq!(resp.address, B_ADDR);
    assert_eq!(resp.sender, SENDER);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_on_success(c_msg(&ExecuteMsg::IncrNumber(1)), 0),
                    SubMsg::new(c_msg(&ExecuteMsg::IncrNumber(1)))
                ])
            ),
            3
        ),
        SubMsg::reply_always(b_msg(&ExecuteMsg::IncrNumber(2)), 4)
    ]);

    let resp = c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();
    let mut resp = resp.iter();

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

    assert_eq!(
        c.b_events(0).unwrap_err().to_string(),
        no_reply_stored_err(0).to_string()
    );

    assert_eq!(
        c.b_events(2).unwrap_err().to_string(),
        no_reply_stored_err(2).to_string()
    );

    assert_eq!(
        c.a_events(1).unwrap_err().to_string(),
        no_reply_stored_err(1).to_string()
    );

    assert_eq!(
        c.a_events(3).unwrap_err().to_string(),
        no_reply_stored_err(3).to_string()
    );

    cmp_response_json(
        &c.a_events(4).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMg==\"}"
    );
}

#[test]
fn correct_events_passed_to_reply() {
    let mut c = init([None, None, None]);
    c.ensemble.add_funds(C_ADDR, vec![coin(200, "uscrt")]);

    let msg = ExecuteMsg::RunMsgs(vec![
        SubMsg::reply_always(
            b_msg(
                &ExecuteMsg::RunMsgs(vec![
                    SubMsg::reply_always(
                        c_msg(&ExecuteMsg::IncrAndSend {
                            amount: 1,
                            recipient: A_ADDR.into()
                        }),
                        0
                    ),
                    SubMsg::reply_on_error(c_msg(&ExecuteMsg::Fail), 1),
                    SubMsg::reply_always(c_msg(&ExecuteMsg::IncrNumber(1)), 2),
                ])
            ),
            3
        ),
        SubMsg::reply_always(
            c_msg(&ExecuteMsg::IncrAndSend {
                amount: 3,
                recipient: B_ADDR.into()
            }),
            4
        ),
    ]);

    c.ensemble.execute(&msg, MockEnv::new(SENDER, c.a.address.clone())).unwrap();

    let state = c.a_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 100);

    let state = c.b_state();
    assert_eq!(state.num, 0);
    assert_eq!(state.balance.amount.u128(), 100);

    let state = c.c_state();
    assert_eq!(state.num, 5);
    assert_eq!(state.balance.amount.u128(), 0);

    cmp_response_json(
        &c.b_events(0).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"spender\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"receiver\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"recipient\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"sender\",\"value\":\"c\",\"encrypted\":true}]}],\"data\":null}"
    );

    assert_eq!(
        c.b_events(1).unwrap_err().to_string(),
        no_reply_stored_err(1).to_string()
    );

    cmp_response_json(
        &c.b_events(2).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]}],\"data\":\"SW5jcmVtZW50IGFtb3VudDogMQ==\"}"
    );

    cmp_response_json(
        &c.a_events(3).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: b\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"spender\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"receiver\",\"value\":\"a\",\"encrypted\":true}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"recipient\",\"value\":\"a\",\"encrypted\":true},{\"key\":\"sender\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 0, success: true\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 1, success: false\",\"encrypted\":true}]},{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: b\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"reply\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"submsg_reply\",\"value\":\"address: b, id: 2, success: true\",\"encrypted\":true}]}],\"data\":null}"
    );

    cmp_response_json(
        &c.a_events(4).unwrap(),
        "{\"events\":[{\"type\":\"execute\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm\",\"attributes\":[{\"key\":\"ANOTHER_TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"TEST_ATTR\",\"value\":\"test\",\"encrypted\":true},{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"wasm-MSG_ORDER\",\"attributes\":[{\"key\":\"contract_address\",\"value\":\"c\",\"encrypted\":true},{\"key\":\"submsg_execute\",\"value\":\"sender: a\\ncontract: c\",\"encrypted\":true}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"spender\",\"value\":\"c\",\"encrypted\":true}]},{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"receiver\",\"value\":\"b\",\"encrypted\":true}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"amount\",\"value\":\"100uscrt\",\"encrypted\":true},{\"key\":\"recipient\",\"value\":\"b\",\"encrypted\":true},{\"key\":\"sender\",\"value\":\"c\",\"encrypted\":true}]}],\"data\":null}"
    );
}

fn init(msgs: [Option<u64>; 3]) -> TestContracts {
    let mut ensemble = ContractEnsemble::new();
    let contract = ensemble.register(Box::new(Contract));

    let a = ensemble.instantiate(
        contract.id,
        &InstantiateMsg {
            reply_fail_id: msgs[0]
        },
        MockEnv::new(SENDER, A_ADDR)
    ).unwrap();

    let b = ensemble.instantiate(
        contract.id,
        &InstantiateMsg {
            reply_fail_id: msgs[1]
        },
        MockEnv::new(SENDER, B_ADDR)
    ).unwrap();

    let c = ensemble.instantiate(
        contract.id,
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

fn cmp_response_json(resp: &SubMsgResponse, json: &'static str) {
    assert_eq!(
        String::from_utf8(to_vec(&resp).unwrap()).unwrap(),
        json
    )
}

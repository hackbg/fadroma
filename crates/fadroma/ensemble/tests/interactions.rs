use serde::{Deserialize, Serialize};
use anyhow::{Result as AnyResult, bail};

use crate::ensemble::{
    ContractEnsemble, ContractHarness, MockDeps,
    MockEnv, EnsembleResult, EnsembleError
};
use crate::prelude::*;

const SEND_AMOUNT: u128 = 100;
const SEND_DENOM: &str = "uscrt";

struct Counter;

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct CounterInit {
    info: ContractInstantiationInfo,
    fail: bool,
    fail_multiplier: bool,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
enum CounterHandle {
    Increment,
    IncrementAndMultiply { by: u8 },
    RegisterMultiplier,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
enum CounterQuery {
    Number,
    Multiplier,
}

impl ContractHarness for Counter {
    fn instantiate(
        &self,
        deps: &mut MockDeps,
        env: Env,
        _info: MessageInfo,
        msg: Binary,
    ) -> AnyResult<Response> {
        let msg: CounterInit = from_binary(&msg)?;

        save(
            &mut deps.storage,
            b"mul",
            &ContractLink {
                address: Addr::unchecked(""),
                code_hash: msg.info.code_hash.clone(),
            },
        )?;

        if msg.fail {
            bail!("Failed at Counter.");
        }

        Ok(Response::new().add_message(WasmMsg::Instantiate {
            code_id: msg.info.id,
            code_hash: msg.info.code_hash,
            funds: vec![coin(SEND_AMOUNT, SEND_DENOM)],
            msg: to_binary(&MultiplierInit {
                callback: Callback {
                    contract: ContractLink {
                        address: env.contract.address,
                        code_hash: env.contract.code_hash,
                    },
                    msg: to_binary(&CounterHandle::RegisterMultiplier)?,
                },
                fail: msg.fail_multiplier,
            })?,
            label: "multiplier".into(),
        }))
    }

    fn execute(
        &self,
        deps: &mut MockDeps,
        _env: Env,
        info: MessageInfo,
        msg: Binary,
    ) -> AnyResult<Response> {
        let msg: CounterHandle = from_binary(&msg)?;

        match msg {
            CounterHandle::Increment => {
                increment(&mut deps.storage)?;
            }
            CounterHandle::RegisterMultiplier => {
                let mut contract_info: ContractLink<Addr> = load(&deps.storage, b"mul")?.unwrap();
                contract_info.address = info.sender;

                save(&mut deps.storage, b"mul", &contract_info)?;
            }
            CounterHandle::IncrementAndMultiply { by } => {
                let number = increment(&mut deps.storage)?;
                let multiplier: ContractLink<Addr> = load(&deps.storage, b"mul")?.unwrap();

                return Ok(Response::new().add_message(WasmMsg::Execute {
                    contract_addr: multiplier.address.into_string(),
                    code_hash: multiplier.code_hash,
                    msg: to_binary(&MultiplierHandle {
                        number,
                        multiplier: by,
                    })?,
                    funds: vec![],
                }));
            }
        }

        Ok(Response::default())
    }

    fn query(&self, deps: &MockDeps, _env: Env, msg: Binary) -> AnyResult<Binary> {
        let msg: CounterQuery = from_binary(&msg)?;

        let bin = match msg {
            CounterQuery::Number => {
                let number: u8 = load(&deps.storage, b"num")?.unwrap_or_default();

                to_binary(&number)?
            }
            CounterQuery::Multiplier => {
                let multiplier: ContractLink<Addr> = load(&deps.storage, b"mul")?.unwrap();

                to_binary(&multiplier)?
            }
        };

        Ok(bin)
    }
}

fn increment(storage: &mut impl Storage) -> StdResult<u8> {
    let mut number: u8 = load(storage, b"num")?.unwrap_or_default();
    number += 1;

    save(storage, b"num", &number)?;

    Ok(number)
}

struct Multiplier;

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct MultiplierInit {
    callback: Callback<Addr>,
    fail: bool,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct MultiplierHandle {
    number: u8,
    multiplier: u8,
}

impl ContractHarness for Multiplier {
    fn instantiate(
        &self,
        _deps: &mut MockDeps,
        _env: Env,
        _info: MessageInfo,
        msg: Binary,
    ) -> AnyResult<Response> {
        let msg: MultiplierInit = from_binary(&msg)?;

        if msg.fail {
            bail!("Failed at Multiplier.");
        }

        Ok(Response::new().add_message(WasmMsg::Execute {
            contract_addr: msg.callback.contract.address.into_string(),
            code_hash: msg.callback.contract.code_hash,
            msg: msg.callback.msg,
            funds: vec![],
        }))
    }

    fn execute(
        &self,
        deps: &mut MockDeps,
        _env: Env,
        _info: MessageInfo,
        msg: Binary,
    ) -> AnyResult<Response> {
        let msg: MultiplierHandle = from_binary(&msg)?;

        let result = msg
            .number
            .checked_mul(msg.multiplier)
            .ok_or_else(|| StdError::generic_err("Mul overflow."))?;

        save(&mut deps.storage, b"last", &result)?;

        Ok(Response::default())
    }

    fn query(&self, deps: &MockDeps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        let last: u8 = load(&deps.storage, b"last")?.unwrap();
        let result = to_binary(&last)?;

        Ok(result)
    }
}

#[derive(Debug)]
struct InitResult {
    counter: ContractLink<Addr>,
    multiplier: ContractLink<Addr>,
}

fn init(
    ensemble: &mut ContractEnsemble,
    fail_counter: bool,
    fail_multiplier: bool,
) -> EnsembleResult<InitResult> {
    let counter = ensemble.register(Box::new(Counter));
    let multiplier = ensemble.register(Box::new(Multiplier));

    let admin = "admin";
    ensemble.add_funds(admin, vec![coin(SEND_AMOUNT, SEND_DENOM)]);

    let counter = ensemble
        .instantiate(
            counter,
            &CounterInit {
                info: multiplier.clone(),
                fail: fail_counter,
                fail_multiplier,
            },
            MockEnv::new(
                admin,
                "counter"
            )
            .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )?
        .instance;

    Ok(InitResult {
        counter,
        multiplier: ContractLink {
            address: Addr::unchecked("multiplier"),
            code_hash: multiplier.code_hash,
        },
    })
}

struct BlockHeight;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum BlockHeightHandle {
    Set,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct Block {
    height: u64,
    time: u64,
}

impl ContractHarness for BlockHeight {
    fn instantiate(&self, deps: &mut MockDeps, env: Env, _info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
        save(
            &mut deps.storage,
            b"block",
            &Block {
                height: env.block.height,
                time: env.block.time.seconds(),
            },
        )?;

        Ok(Response::default())
    }

    fn execute(
        &self,
        deps: &mut MockDeps,
        env: Env,
        _info: MessageInfo,
        msg: Binary,
    ) -> AnyResult<Response> {
        let msg: BlockHeightHandle = from_binary(&msg)?;
        match msg {
            BlockHeightHandle::Set => {
                save(
                    &mut deps.storage,
                    b"block",
                    &Block {
                        height: env.block.height,
                        time: env.block.time.seconds(),
                    },
                )?;
            }
        };

        Ok(Response::default())
    }

    fn query(&self, deps: &MockDeps, _env: Env, _msg: Binary) -> AnyResult<Binary> {
        let block: Block = load(&deps.storage, b"block")?.unwrap();
        let result = to_binary(&block)?;

        Ok(result)
    }
}

#[test]
fn test_removes_instances_on_failed_init() {
    let mut ensemble = ContractEnsemble::new();
    let result = init(&mut ensemble, false, false).unwrap();
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 2);

    let balances = ensemble.balances(result.multiplier.address.clone()).unwrap();
    assert_eq!(balances.len(), 1);
    assert_eq!(
        *balances.get(SEND_DENOM).unwrap(),
        Uint128::new(SEND_AMOUNT)
    );

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 0);

    let multiplier: ContractLink<Addr> = ensemble
        .query(result.counter.address, &CounterQuery::Multiplier)
        .unwrap();

    assert_eq!(multiplier, result.multiplier);

    let mut ensemble = ContractEnsemble::new();
    let result = init(&mut ensemble, true, false).unwrap_err();
    assert_eq!(result.to_string(), "Failed at Counter.");
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 0);

    let mut ensemble = ContractEnsemble::new();
    let result = init(&mut ensemble, false, true).unwrap_err();
    assert_eq!(
        result.to_string(),
        "Failed at Multiplier."
    );
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 0);
}

#[test]
fn test_reverts_state_on_fail() {
    let sender = "sender";

    let mut ensemble = ContractEnsemble::new();
    ensemble.add_funds(sender, vec![coin(SEND_AMOUNT * 2, SEND_DENOM)]);

    let result = init(&mut ensemble, false, false).unwrap();

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.address.clone()),
        )
        .unwrap();

    let number: u8 = ensemble
        .query(&result.counter.address, &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 1);

    ensemble
        .deps_mut(result.counter.address.clone(), |deps| {
            deps.storage.set(b"num", &to_vec(&2u8).unwrap());
        })
        .unwrap();

    ensemble
        .execute(
            &CounterHandle::IncrementAndMultiply { by: 2 },
            MockEnv::new(sender, result.counter.address.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances(result.counter.address.clone()).unwrap();
    assert_eq!(
        *balances.get(SEND_DENOM).unwrap(),
        Uint128::new(SEND_AMOUNT)
    );

    let number: u8 = ensemble
        .query(&result.counter.address, &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 3);

    let number: u8 = ensemble
        .query(&result.multiplier.address, &Empty {})
        .unwrap();
    assert_eq!(number, 6);

    let err = ensemble
        .execute(
            &CounterHandle::IncrementAndMultiply { by: 100 },
            MockEnv::new(sender, result.counter.address.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap_err();

    assert_eq!(
        err.unwrap_contract_error().downcast::<StdError>().unwrap(),
        StdError::generic_err("Mul overflow.")
    );

    let number: u8 = ensemble
        .query(&result.counter.address, &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 3);

    let number: u8 = ensemble
        .query(result.multiplier.address.clone(), &Empty {})
        .unwrap();
    assert_eq!(number, 6);

    let balances = ensemble.balances(result.counter.address.clone()).unwrap();
    assert_eq!(
        *balances.get(SEND_DENOM).unwrap(),
        Uint128::new(SEND_AMOUNT)
    );

    ensemble
        .deps(result.counter.address.clone(), |deps| {
            let request = to_binary(&QueryRequest::<Empty>::Wasm(WasmQuery::Smart {
                contract_addr: result.counter.address.to_string(),
                code_hash: result.counter.code_hash.clone(),
                msg: to_binary(&CounterQuery::Number).unwrap(),
            }))
            .unwrap();

            let number = deps
                .querier
                .raw_query(&request)
                .unwrap()
                .unwrap();

            let number: u8 = from_binary(&number).unwrap();

            assert_eq!(number, 3);

            let number: u8 = load(&deps.storage, b"num").unwrap().unwrap();

            assert_eq!(number, 3);
        })
        .unwrap();
}

#[test]
#[should_panic(
    expected = "Insufficient balance: sender: sender, denom: uscrt, balance: 0, required: 100"
)]
fn insufficient_balance() {
    let sender = "sender";

    let mut ensemble = ContractEnsemble::new();
    ensemble.add_funds(sender, vec![coin(SEND_AMOUNT * 2, SEND_DENOM)]);

    let result = init(&mut ensemble, false, false).unwrap();

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.address.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances_mut(sender.clone()).unwrap();
    balances.remove_entry(SEND_DENOM);

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.address.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();
}

#[test]
fn exact_increment() {
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();
    ensemble.block_mut().exact_increments(10, 7);
    ensemble.block_mut().height = 0;
    ensemble.block_mut().time = 0;

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract,
            &Empty {},
            MockEnv::new(
                admin,
                "block_height"
            ),
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(
                admin,
                block_height.address.clone()
            ),
        )
        .unwrap();

    let res: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();

    assert_eq!(
        res,
        Block {
            height: 10,
            time: 70
        }
    );

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.address.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();
    assert_eq!(
        res,
        Block {
            height: 20,
            time: 140
        }
    );
}

#[test]
fn random_increment() {
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();
    ensemble.block_mut().random_increments(1..11, 1..9);

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract,
            &Empty {},
            MockEnv::new(
                admin,
                "block_height"
            ),
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.address.clone()),
        )
        .unwrap();

    let block: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();

    assert!(block.height > 0);
    assert!(block.time > 0);

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.address.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();

    assert!(block.height < res.height);
    assert!(block.time < res.time);
}

#[test]
fn block_freeze() {
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();

    let old_height = ensemble.block().height;
    let old_time = ensemble.block().time;

    ensemble.block_mut().freeze();

    let block_height_contract = ensemble.register(Box::new(BlockHeight));
    let block_height = ensemble
        .instantiate(
            block_height_contract,
            &Empty {},
            MockEnv::new(admin, "block_height")
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.address.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();

    assert_eq!(
        res,
        Block {
            height: old_height,
            time: old_time
        }
    );

    ensemble.block_mut().unfreeze();
    ensemble.block_mut().next();

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.address.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(&block_height.address, &Empty {})
        .unwrap();

    assert!(res.height > old_height);
    assert!(res.time > old_time);
}

#[test]
fn remove_funds() {
    let mut ensemble = ContractEnsemble::new();
    let addr = "address";

    ensemble.add_funds(addr, vec![Coin::new(1000u128, "uscrt")]);
    assert_eq!(
        ensemble
            .ctx
            .bank
            .current
            .query_balances(&addr, Some("uscrt".to_string())),
        vec![Coin::new(1000u128, "uscrt")],
    );

    ensemble
        .remove_funds(addr, vec![Coin::new(500u128, "uscrt")])
        .unwrap();
    assert_eq!(
        ensemble
            .ctx
            .bank
            .current
            .query_balances(&addr, Some("uscrt".to_string())),
        vec![Coin::new(500u128, "uscrt")],
    );

    match ensemble.remove_funds(addr, vec![Coin::new(600u128, "uscrt")]) {
        Err(error) => match error {
            EnsembleError::Bank(msg) => assert_eq!(
                msg,
                "Insufficient balance: account: address, denom: uscrt, balance: 500, required: 600"
            ),
            _ => panic!("Wrong error message"),
        },
        _ => panic!("No error message"),
    };

    match ensemble.remove_funds(addr, vec![Coin::new(300u128, "notscrt")]) {
        Err(error) => match error {
            EnsembleError::Bank(msg) => assert_eq!(
                msg,
                "Insufficient balance: account: address, denom: notscrt, balance: 0, required: 300"
            ),
            _ => panic!("Wrong error message"),
        },
        _ => panic!("No error message"),
    };

    match ensemble.remove_funds(
        "address2",
        vec![Coin::new(300u128, "uscrt")],
    ) {
        Err(error) => match error {
            EnsembleError::Bank(msg) => {
                assert_eq!(msg, "Account address2 does not exist for remove balance")
            }
            _ => panic!("Wrong error message"),
        },
        _ => panic!("No error message"),
    };
}

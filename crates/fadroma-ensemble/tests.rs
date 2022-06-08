use crate::{ContractEnsemble, ContractHarness, MockDeps, MockEnv};
use fadroma_platform_scrt::{
    coin, from_binary, schemars, schemars::JsonSchema, to_binary, to_vec, Binary, Callback,
    ContractInstantiationInfo, ContractLink, CosmosMsg, Empty, Env, HandleResponse, HumanAddr,
    InitResponse, Querier, QueryRequest, StdError, StdResult, Storage, Uint128, WasmMsg, WasmQuery,
};
use fadroma_storage::{load, save};

use serde::{Deserialize, Serialize};

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
    fn init(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<InitResponse> {
        let msg: CounterInit = from_binary(&msg)?;

        save(
            &mut deps.storage,
            b"mul",
            &ContractLink {
                address: HumanAddr::default(),
                code_hash: msg.info.code_hash.clone(),
            },
        )?;

        if msg.fail {
            return Err(StdError::generic_err("Failed at Counter."));
        }

        Ok(InitResponse {
            messages: vec![CosmosMsg::Wasm(WasmMsg::Instantiate {
                code_id: msg.info.id,
                callback_code_hash: msg.info.code_hash,
                send: vec![coin(SEND_AMOUNT, SEND_DENOM)],
                msg: to_binary(&MultiplierInit {
                    callback: Callback {
                        contract: ContractLink {
                            address: env.contract.address,
                            code_hash: env.contract_code_hash,
                        },
                        msg: to_binary(&CounterHandle::RegisterMultiplier)?,
                    },
                    fail: msg.fail_multiplier,
                })?,
                label: "multiplier".into(),
            })],
            log: vec![],
        })
    }

    fn handle(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<HandleResponse> {
        let msg: CounterHandle = from_binary(&msg)?;

        match msg {
            CounterHandle::Increment => {
                increment(&mut deps.storage)?;
            }
            CounterHandle::RegisterMultiplier => {
                let mut info: ContractLink<HumanAddr> = load(&deps.storage, b"mul")?.unwrap();
                info.address = env.message.sender;

                save(&mut deps.storage, b"mul", &info)?;
            }
            CounterHandle::IncrementAndMultiply { by } => {
                let number = increment(&mut deps.storage)?;
                let multiplier: ContractLink<HumanAddr> = load(&deps.storage, b"mul")?.unwrap();

                return Ok(HandleResponse {
                    messages: vec![CosmosMsg::Wasm(WasmMsg::Execute {
                        contract_addr: multiplier.address,
                        callback_code_hash: multiplier.code_hash,
                        msg: to_binary(&MultiplierHandle {
                            number,
                            multiplier: by,
                        })?,
                        send: vec![],
                    })],
                    log: vec![],
                    data: None,
                });
            }
        }

        Ok(HandleResponse::default())
    }

    fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
        let msg: CounterQuery = from_binary(&msg)?;

        match msg {
            CounterQuery::Number => {
                let number: u8 = load(&deps.storage, b"num")?.unwrap_or_default();

                to_binary(&number)
            }
            CounterQuery::Multiplier => {
                let multiplier: ContractLink<HumanAddr> = load(&deps.storage, b"mul")?.unwrap();

                to_binary(&multiplier)
            }
        }
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
    callback: Callback<HumanAddr>,
    fail: bool,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct MultiplierHandle {
    number: u8,
    multiplier: u8,
}

impl ContractHarness for Multiplier {
    fn init(&self, _deps: &mut MockDeps, _env: Env, msg: Binary) -> StdResult<InitResponse> {
        let msg: MultiplierInit = from_binary(&msg)?;

        if msg.fail {
            return Err(StdError::generic_err("Failed at Multiplier."));
        }

        Ok(InitResponse {
            messages: vec![CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: msg.callback.contract.address,
                callback_code_hash: msg.callback.contract.code_hash,
                msg: msg.callback.msg,
                send: vec![],
            })],
            log: vec![],
        })
    }

    fn handle(&self, deps: &mut MockDeps, _env: Env, msg: Binary) -> StdResult<HandleResponse> {
        let msg: MultiplierHandle = from_binary(&msg)?;

        let result = msg
            .number
            .checked_mul(msg.multiplier)
            .ok_or_else(|| StdError::generic_err("Mul overflow."))?;

        save(&mut deps.storage, b"last", &result)?;

        Ok(HandleResponse::default())
    }

    fn query(&self, deps: &MockDeps, _msg: Binary) -> StdResult<Binary> {
        let last: u8 = load(&deps.storage, b"last")?.unwrap();

        to_binary(&last)
    }
}

#[derive(Debug)]
struct InitResult {
    counter: ContractLink<HumanAddr>,
    multiplier: ContractLink<HumanAddr>,
}

fn init(
    ensemble: &mut ContractEnsemble,
    fail_counter: bool,
    fail_multiplier: bool,
) -> StdResult<InitResult> {
    let counter = ensemble.register(Box::new(Counter));
    let multiplier = ensemble.register(Box::new(Multiplier));

    let admin = "admin";
    ensemble.add_funds(admin, vec![coin(SEND_AMOUNT, SEND_DENOM)]);

    let counter = ensemble.instantiate(
        counter.id,
        &CounterInit {
            info: multiplier.clone(),
            fail: fail_counter,
            fail_multiplier,
        },
        MockEnv::new(
            admin,
            ContractLink {
                address: "counter".into(),
                code_hash: counter.code_hash.clone(),
            },
        )
        .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
    )?;

    Ok(InitResult {
        counter,
        multiplier: ContractLink {
            address: "multiplier".into(),
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
    fn init(&self, deps: &mut MockDeps, env: Env, _msg: Binary) -> StdResult<InitResponse> {
        save(
            &mut deps.storage,
            b"block",
            &Block {
                height: env.block.height,
                time: env.block.time,
            },
        )?;

        Ok(InitResponse::default())
    }

    fn handle(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<HandleResponse> {
        let msg: BlockHeightHandle = from_binary(&msg)?;
        match msg {
            BlockHeightHandle::Set => {
                save(
                    &mut deps.storage,
                    b"block",
                    &Block {
                        height: env.block.height,
                        time: env.block.time,
                    },
                )?;
            }
        };

        Ok(HandleResponse::default())
    }

    fn query(&self, deps: &MockDeps, _msg: Binary) -> StdResult<Binary> {
        let block: Block = load(&deps.storage, b"block")?.unwrap();
        to_binary(&block)
    }
}

#[test]
fn test_removes_instances_on_failed_init() {
    let mut ensemble = ContractEnsemble::new(20);
    let result = init(&mut ensemble, false, false).unwrap();
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 2);

    let balances = ensemble.balances(&result.multiplier.address).unwrap();
    assert_eq!(balances.len(), 1);
    assert_eq!(*balances.get(SEND_DENOM).unwrap(), Uint128(SEND_AMOUNT));

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 0);

    let multiplier: ContractLink<HumanAddr> = ensemble
        .query(result.counter.address, &CounterQuery::Multiplier)
        .unwrap();
    assert_eq!(multiplier, result.multiplier);

    let mut ensemble = ContractEnsemble::new(20);
    let result = init(&mut ensemble, true, false).unwrap_err();
    assert_eq!(result, StdError::generic_err("Failed at Counter."));
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 0);

    let mut ensemble = ContractEnsemble::new(20);
    let result = init(&mut ensemble, false, true);
    assert_eq!(
        result.unwrap_err(),
        StdError::generic_err("Failed at Multiplier.")
    );
    assert_eq!(ensemble.ctx.contracts.len(), 2);
    assert_eq!(ensemble.ctx.instances.len(), 0);
}

#[test]
fn test_reverts_state_on_fail() {
    let sender = "sender";

    let mut ensemble = ContractEnsemble::new(20);
    ensemble.add_funds(sender, vec![coin(SEND_AMOUNT * 2, SEND_DENOM)]);

    let result = init(&mut ensemble, false, false).unwrap();

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.clone()),
        )
        .unwrap();

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 1);

    ensemble
        .deps_mut(&result.counter.address, |deps| {
            deps.storage.set(b"num", &to_vec(&2u8).unwrap());
        })
        .unwrap();

    ensemble
        .execute(
            &CounterHandle::IncrementAndMultiply { by: 2 },
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances(&result.counter.address).unwrap();
    assert_eq!(*balances.get(SEND_DENOM).unwrap(), Uint128(SEND_AMOUNT));

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 3);

    let number: u8 = ensemble
        .query(result.multiplier.address.clone(), &Empty {})
        .unwrap();
    assert_eq!(number, 6);

    let err = ensemble
        .execute(
            &CounterHandle::IncrementAndMultiply { by: 100 },
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap_err();

    assert_eq!(err, StdError::generic_err("Mul overflow."));

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
        .unwrap();
    assert_eq!(number, 3);

    let number: u8 = ensemble
        .query(result.multiplier.address.clone(), &Empty {})
        .unwrap();
    assert_eq!(number, 6);

    let balances = ensemble.balances(&result.counter.address).unwrap();
    assert_eq!(*balances.get(SEND_DENOM).unwrap(), Uint128(SEND_AMOUNT));

    ensemble
        .deps(&result.counter.address, |deps| {
            let number: u8 = deps
                .querier
                .query(&QueryRequest::Wasm(WasmQuery::Smart {
                    contract_addr: result.counter.address.clone(),
                    callback_code_hash: result.counter.code_hash.clone(),
                    msg: to_binary(&CounterQuery::Number).unwrap(),
                }))
                .unwrap();

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

    let mut ensemble = ContractEnsemble::new(20);
    ensemble.add_funds(sender, vec![coin(SEND_AMOUNT * 2, SEND_DENOM)]);

    let result = init(&mut ensemble, false, false).unwrap();

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances_mut(sender).unwrap();
    balances.remove_entry(SEND_DENOM);

    ensemble
        .execute(
            &CounterHandle::Increment,
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();
}

#[test]
fn exact_increment() {
    let mut ensemble = ContractEnsemble::new(50);
    ensemble.block_mut().exact_increments(10, 7);
    ensemble.block_mut().height = 0;
    ensemble.block_mut().time = 0;

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract.id,
            &Empty {},
            MockEnv::new(
                "Admin",
                ContractLink {
                    address: "block_height".into(),
                    code_hash: block_height_contract.code_hash,
                },
            ),
        )
        .unwrap();

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new("Admin", block_height.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
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
            MockEnv::new("Admin", block_height.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
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
    let mut ensemble = ContractEnsemble::new(50);
    ensemble.block_mut().random_increments(1..11, 1..9);

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract.id,
            &Empty {},
            MockEnv::new(
                "Admin",
                ContractLink {
                    address: "block_height".into(),
                    code_hash: block_height_contract.code_hash,
                },
            ),
        )
        .unwrap();

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new("Admin", block_height.clone()),
        )
        .unwrap();

    let block: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
        .unwrap();

    assert!(block.height > 0);
    assert!(block.time > 0);

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new("Admin", block_height.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
        .unwrap();

    assert!(block.height < res.height);
    assert!(block.time < res.time);
}

#[test]
fn block_freeze() {
    let mut ensemble = ContractEnsemble::new(50);

    let old_height = ensemble.block().height;
    let old_time = ensemble.block().time;

    ensemble.block_mut().freeze();

    let block_height_contract = ensemble.register(Box::new(BlockHeight));
    let block_height = ensemble.instantiate(
        block_height_contract.id,
        &Empty {},
        MockEnv::new(
            "Admin",
            ContractLink {
                address: "block_height".into(),
                code_hash: block_height_contract.code_hash,
            },
        ),
    )
    .unwrap();

    ensemble.execute(
        &BlockHeightHandle::Set,
        MockEnv::new("Admin", block_height.clone()),
    )
    .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
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

    ensemble.execute(
        &BlockHeightHandle::Set,
        MockEnv::new("Admin", block_height.clone()),
    )
    .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
        .unwrap();

    assert!(res.height > old_height);
    assert!(res.time > old_time);
}

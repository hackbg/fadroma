use serde::{Deserialize, Serialize};
use anyhow::{Result as AnyResult, bail};

use super::response::{RewardsResponse, ValidatorRewards};
use super::{ContractEnsemble, ContractHarness, MockDeps, MockEnv};
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

    fn query(&self, deps: &MockDeps, msg: Binary) -> AnyResult<Binary> {
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

    fn query(&self, deps: &MockDeps, _msg: Binary) -> AnyResult<Binary> {
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
) -> AnyResult<InitResult> {
    let counter = ensemble.register(Box::new(Counter));
    let multiplier = ensemble.register(Box::new(Multiplier));

    let admin = "admin";
    ensemble.add_funds(admin, vec![coin(SEND_AMOUNT, SEND_DENOM)]);

    let counter = ensemble
        .instantiate(
            counter.id,
            &CounterInit {
                info: multiplier.clone(),
                fail: fail_counter,
                fail_multiplier,
            },
            MockEnv::new(
                admin,
                ContractLink {
                    address: Addr::unchecked("counter"),
                    code_hash: counter.code_hash.clone(),
                },
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

    fn query(&self, deps: &MockDeps, _msg: Binary) -> AnyResult<Binary> {
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
    let result = init(&mut ensemble, false, true);
    assert_eq!(
        result.unwrap_err().to_string(),
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
            MockEnv::new(sender, result.counter.clone()),
        )
        .unwrap();

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
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
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances(result.counter.address.clone()).unwrap();
    assert_eq!(
        *balances.get(SEND_DENOM).unwrap(),
        Uint128::new(SEND_AMOUNT)
    );

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

    assert_eq!(
        err.downcast::<StdError>().unwrap(),
        StdError::generic_err("Mul overflow.")
    );

    let number: u8 = ensemble
        .query(result.counter.address.clone(), &CounterQuery::Number)
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
            MockEnv::new(sender, result.counter.clone())
                .sent_funds(vec![coin(SEND_AMOUNT, SEND_DENOM)]),
        )
        .unwrap();

    let balances = ensemble.balances_mut(sender.clone()).unwrap();
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
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();
    ensemble.block_mut().exact_increments(10, 7);
    ensemble.block_mut().height = 0;
    ensemble.block_mut().time = 0;

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract.id,
            &Empty {},
            MockEnv::new(
                admin,
                ContractLink {
                    address: Addr::unchecked("block_height"),
                    code_hash: block_height_contract.code_hash,
                },
            ),
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(
                admin,
                block_height.clone()
            ),
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
            MockEnv::new(admin, block_height.clone()),
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
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();
    ensemble.block_mut().random_increments(1..11, 1..9);

    let block_height_contract = ensemble.register(Box::new(BlockHeight));

    let block_height = ensemble
        .instantiate(
            block_height_contract.id,
            &Empty {},
            MockEnv::new(
                admin,
                ContractLink {
                    address: Addr::unchecked("block_height"),
                    code_hash: block_height_contract.code_hash,
                },
            ),
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.clone()),
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
            MockEnv::new(admin, block_height.clone()),
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
    let admin = "admin";

    let mut ensemble = ContractEnsemble::new();

    let old_height = ensemble.block().height;
    let old_time = ensemble.block().time;

    ensemble.block_mut().freeze();

    let block_height_contract = ensemble.register(Box::new(BlockHeight));
    let block_height = ensemble
        .instantiate(
            block_height_contract.id,
            &Empty {},
            MockEnv::new(
                admin,
                ContractLink {
                    address: Addr::unchecked("block_height"),
                    code_hash: block_height_contract.code_hash,
                },
            ),
        )
        .unwrap()
        .instance;

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.clone()),
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

    ensemble
        .execute(
            &BlockHeightHandle::Set,
            MockEnv::new(admin, block_height.clone()),
        )
        .unwrap();

    let res: Block = ensemble
        .query(block_height.address.clone(), &Empty {})
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
            StdError::GenericErr { msg, .. } => assert_eq!(
                msg,
                "Insufficient balance: account: address, denom: uscrt, balance: 500, required: 600"
            ),
            _ => panic!("Wrong error message"),
        },
        _ => panic!("No error message"),
    };

    match ensemble.remove_funds(addr, vec![Coin::new(300u128, "notscrt")]) {
        Err(error) => match error {
            StdError::GenericErr { msg, .. } => assert_eq!(
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
            StdError::NotFound { kind, .. } => {
                assert_eq!(kind, "Account address2 does not exist for remove balance")
            }
            _ => panic!("Wrong error message"),
        },
        _ => panic!("No error message"),
    };
}

#[test]
fn staking() {
    let ensemble_test = ContractEnsemble::new_with_denom("something");
    assert_eq!(
        ensemble_test.ctx.delegations.bonded_denom(),
        "something".to_string()
    );

    let mut ensemble = ContractEnsemble::new();
    assert_eq!(ensemble.ctx.delegations.bonded_denom(), "uscrt");

    let addr1 = "addr1";
    let addr2 = "addr2";

    let val_addr_1 = "validator1";
    let val_addr_2 = "validator2";
    let val_addr_3 = "validator3";

    let validator1 = Validator {
        address: val_addr_1.to_string(),
        commission: Decimal::percent(5),
        max_commission: Decimal::percent(10),
        max_change_rate: Decimal::percent(1),
    };
    let validator2 = Validator {
        address: val_addr_2.to_string(),
        commission: Decimal::percent(7),
        max_commission: Decimal::percent(15),
        max_change_rate: Decimal::percent(5),
    };

    ensemble.add_funds(addr1.clone(), vec![Coin::new(1100u128, "uscrt")]);
    ensemble.add_funds(addr1.clone(), vec![Coin::new(314159u128, "notscrt")]);
    ensemble.add_validator(validator1.clone());
    ensemble.add_validator(validator2.clone());

    // TODO test remove_funds

    assert_eq!(
        ensemble.ctx.delegations.validators(),
        vec![validator1.clone(), validator2.clone()]
    );

    // Delegating (while replicating structure of the ensemble.rs execute_message() delegate code)
    ensemble
        .ctx
        .bank
        .writable()
        .remove_funds(&addr1, vec![Coin::new(1000u128, "uscrt")])
        .unwrap();
    match ensemble.ctx.delegations.delegate(
        addr1.to_string(),
        val_addr_1.to_string(),
        Coin::new(1000u128, "uscrt"),
    ) {
        Ok(result) => Ok(result),
        Err(result) => {
            ensemble.ctx.bank.revert();
            Err(result)
        }
    }
    .unwrap();
    ensemble.ctx.bank.commit();

    ensemble
        .ctx
        .bank
        .writable()
        .remove_funds(&addr1, vec![Coin::new(314159u128, "notscrt")])
        .unwrap();
    match ensemble.ctx.delegations.delegate(
        addr1.to_string(),
        val_addr_1.to_string(),
        Coin::new(314159u128, "notscrt"),
    ) {
        Err(error) => {
            ensemble.ctx.bank.revert();
            match error {
                StdError::GenericErr { msg, .. } => assert_eq!("Incorrect coin denom", msg),
                _ => panic!("Wrong denom error improperly caught"),
            };
        }
        _ => panic!("Wrong denom error improperly caught"),
    };
    ensemble.ctx.bank.commit();

    ensemble
        .ctx
        .bank
        .writable()
        .remove_funds(&addr1, vec![Coin::new(100u128, "uscrt")])
        .unwrap();
    match ensemble
        .ctx
        .delegations
        .delegate(addr1.to_string(), val_addr_3.into(), Coin::new(100u128, "uscrt"))
    {
        Err(error) => {
            ensemble.ctx.bank.revert();
            match error {
                StdError::NotFound { kind, .. } => assert_eq!("Validator not found", kind),
                _ => panic!("Invalid validator error improperly caught"),
            };
        }
        _ => panic!("Invalid validator error improperly caught"),
    };
    ensemble.ctx.bank.commit();

    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(1000u128, "uscrt"),
                can_redelegate: Coin::new(1000u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        _ => panic!("Incorrect response from delegation query"),
    };
    assert_eq!(
        ensemble.ctx.delegations.delegation(&addr1, &val_addr_2),
        None
    );
    assert_eq!(
        ensemble.ctx.delegations.delegation(&addr2, &val_addr_1),
        None
    );

    // Undelegating
    ensemble
        .ctx
        .delegations
        .undelegate(
            addr1.to_string(),
            val_addr_1.to_string(),
            Coin::new(500u128, "uscrt"),
        )
        .unwrap();
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(500u128, "uscrt"),
                can_redelegate: Coin::new(500u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Delegation not found"),
    };
    match ensemble.ctx.delegations.undelegate(
        addr1.to_string(),
        val_addr_2.to_string(),
        Coin::new(300u128, "uscrt"),
    ) {
        Err(error) => match error {
            StdError::NotFound { kind, .. } => assert_eq!("Delegation not found", kind),
            _ => panic!("Invalid undelegation error improperly caught"),
        },
        _ => panic!("Invalid undelegation error improperly caught"),
    };
    match ensemble.ctx.delegations.undelegate(
        addr1.to_string(),
        val_addr_1.to_string(),
        Coin::new(600u128, "uscrt"),
    ) {
        Err(error) => match error {
            StdError::GenericErr { msg, .. } => assert_eq!("Insufficient funds", msg),
            _ => panic!("Undelegate too much error improperly caught"),
        },
        _ => panic!("Undelegate too much error improperly caught"),
    };
    assert_eq!(
        ensemble.ctx.delegations.unbonding_delegations(&addr1),
        vec![Delegation {
            delegator: Addr::unchecked(addr1.to_string()),
            validator: val_addr_1.to_string(),
            amount: Coin::new(500u128, "uscrt"),
        }],
    );

    // Redelegate
    ensemble
        .ctx
        .delegations
        .redelegate(
            addr1.to_string(),
            val_addr_1.to_string(),
            val_addr_2.to_string(),
            Coin::new(300u128, "uscrt"),
        )
        .unwrap();
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(200u128, "uscrt"),
                can_redelegate: Coin::new(200u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Original delegation not found"),
    };
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_2) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.clone()),
                validator: val_addr_2.to_string(),
                amount: Coin::new(300u128, "uscrt"),
                can_redelegate: Coin::new(0u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Redelegation not found"),
    };

    ensemble
        .ctx
        .bank
        .writable()
        .remove_funds(&addr1, vec![Coin::new(100u128, "uscrt")])
        .unwrap();

    ensemble
        .ctx
        .delegations
        .delegate(
            addr1.to_string(),
            val_addr_2.to_string(),
            Coin::new(100u128, "uscrt"),
        )
        .unwrap();
    ensemble.ctx.bank.commit();

    ensemble
        .ctx
        .delegations
        .redelegate(
            addr1.to_string(),
            val_addr_2.to_string(),
            val_addr_1.to_string(),
            Coin::new(50u128, "uscrt"),
        )
        .unwrap();
    ensemble
        .ctx
        .delegations
        .undelegate(
            addr1.to_string(),
            val_addr_2.to_string(),
            Coin::new(325u128, "uscrt"),
        )
        .unwrap();
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(250u128, "uscrt"),
                can_redelegate: Coin::new(200u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Validator 1 delegation not found"),
    };
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_2) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_2.to_string(),
                amount: Coin::new(25u128, "uscrt"),
                can_redelegate: Coin::new(25u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Validator 2 delegation not found"),
    };

    // Rewards
    ensemble.add_rewards(Uint128::from(50u64));
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(250u128, "uscrt"),
                can_redelegate: Coin::new(200u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(50u128, "uscrt")],
            }
        ),
        None => panic!("Validator 1 delegation not found"),
    };
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_2) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_2.to_string(),
                amount: Coin::new(25u128, "uscrt"),
                can_redelegate: Coin::new(25u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(50u128, "uscrt")],
            }
        ),
        None => panic!("Validator 2 delegation not found"),
    };

    // Trying to replicate as much as possible from ctx.execute_messages() since it is a private
    // function
    let withdraw_amount = ensemble
        .ctx
        .delegations
        .delegation(&addr1.clone(), &val_addr_1.clone())
        .unwrap()
        .accumulated_rewards;

    ensemble
        .ctx
        .bank
        .current
        .add_funds(&addr1, withdraw_amount);

    ensemble
        .ctx
        .delegations
        .withdraw(addr1.to_string(), val_addr_1.to_string())
        .unwrap();

    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(250u128, "uscrt"),
                can_redelegate: Coin::new(200u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Delegation not found"),
    };
    assert_eq!(
        ensemble
            .ctx
            .bank
            .current
            .query_balances(&addr1, Some("uscrt".to_string())),
        vec![Coin::new(50u128, "uscrt")],
    );

    let mut rewards_result = ensemble.ctx.delegations.rewards(&addr1);
    rewards_result.rewards.sort_by(|a, b| {
        a.validator_address
            .to_string()
            .cmp(&b.validator_address.to_string())
    });
    assert_eq!(
        rewards_result,
        RewardsResponse {
            rewards: vec![
                ValidatorRewards {
                    validator_address: val_addr_1.to_string(),
                    reward: vec![Coin::new(0u128, "uscrt")],
                },
                ValidatorRewards {
                    validator_address: val_addr_2.to_string(),
                    reward: vec![Coin::new(50u128, "uscrt")],
                }
            ],
            total: vec![Coin::new(50u128, "uscrt")],
        },
    );

    // Fast forward
    ensemble.fast_forward_delegation_waits();
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_1) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_1.to_string(),
                amount: Coin::new(250u128, "uscrt"),
                can_redelegate: Coin::new(250u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(0u128, "uscrt")],
            }
        ),
        None => panic!("Validator 1 delegation not found"),
    };
    match ensemble.ctx.delegations.delegation(&addr1, &val_addr_2) {
        Some(delegation) => assert_eq!(
            delegation,
            FullDelegation {
                delegator: Addr::unchecked(addr1.to_string()),
                validator: val_addr_2.to_string(),
                amount: Coin::new(25u128, "uscrt"),
                can_redelegate: Coin::new(25u128, "uscrt"),
                accumulated_rewards: vec![Coin::new(50u128, "uscrt")],
            }
        ),
        None => panic!("Validator 2 delegation not found"),
    };
    
    assert_eq!(
        ensemble
            .ctx
            .bank
            .current
            .query_balances(&addr1, Some("uscrt".to_string())),
        vec![Coin::new(875u128, "uscrt")], // 500 undelegate, 325 undelegate, 50 rewards
    );
}

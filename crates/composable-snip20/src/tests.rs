#![cfg(test)]

use fadroma::{
    scrt::{
        Storage, ContractInfo, Api, Querier, Extern, StdResult,
        StdError, InitResponse, HandleResponse, Uint128, WasmMsg,
        MessageInfo, CosmosMsg, Binary, Coin, HumanAddr, QueryResponse,
        Env, BlockInfo, log, to_binary, from_binary
    },
    testing::*,
    scrt_vk::{ViewingKey, VIEWING_KEY_SIZE},
    scrt_crypto::sha_256
};
use std::any::Any;
use crate::{
    snip20_handle, snip20_init, snip20_query, DefaultSnip20Impl,
    SymbolValidation, assert_valid_symbol,
    receiver::Snip20ReceiveMsg,
    batch,
    state::{
        get_receiver_hash, read_allowance, read_viewing_key,
        ReadonlyBalances, ReadonlyConfig
    },
    msg::{*, ContractStatusLevel}
};

fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    snip20_init(deps, env, msg, DefaultSnip20Impl)
}

fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> StdResult<HandleResponse> {
    snip20_handle(deps, env, msg, DefaultSnip20Impl)
}

fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    snip20_query(deps, msg, DefaultSnip20Impl)
}

// Helper functions

fn init_helper(
    initial_balances: Vec<InitialBalance>
) -> (
    StdResult<InitResponse>,
    Extern<MockStorage, MockApi, MockQuerier>,
) {
    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);

    let init_msg = InitMsg {
        name: "sec-sec".to_string(),
        admin: Some(HumanAddr("admin".to_string())),
        symbol: "SECSEC".to_string(),
        decimals: 8,
        initial_balances: Some(initial_balances),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: None,
        callback: None
    };

    (init(&mut deps, env, init_msg), deps)
}

fn init_helper_with_config(
    initial_balances: Vec<InitialBalance>,
    enable_deposit: bool,
    enable_redeem: bool,
    enable_mint: bool,
    enable_burn: bool,
    contract_bal: u128,
) -> (
    StdResult<InitResponse>,
    Extern<MockStorage, MockApi, MockQuerier>,
) {
    let mut deps = mock_dependencies(
        20,
        &[Coin {
            denom: "uscrt".to_string(),
            amount: Uint128(contract_bal),
        }],
    );

    let env = mock_env("instantiator", &[]);
    let init_config: InitConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":false,
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{}}}",
            enable_deposit, enable_redeem, enable_mint, enable_burn
        )
        .as_bytes(),
    ))
    .unwrap();
    let init_msg = InitMsg {
        name: "sec-sec".to_string(),
        admin: Some(HumanAddr("admin".to_string())),
        symbol: "SECSEC".to_string(),
        decimals: 8,
        initial_balances: Some(initial_balances),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None
    };

    (init(&mut deps, env, init_msg), deps)
}

/// Will return a ViewingKey only for the first account in `initial_balances`
fn _auth_query_helper(
    initial_balances: Vec<InitialBalance>,
) -> (ViewingKey, Extern<MockStorage, MockApi, MockQuerier>) {
    let (init_result, mut deps) = init_helper(initial_balances.clone());
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let account = initial_balances[0].address.clone();
    let create_vk_msg = HandleMsg::CreateViewingKey {
        entropy: "42".to_string(),
        padding: None,
    };
    let handle_response = handle(&mut deps, mock_env(account.0, &[]), create_vk_msg).unwrap();
    let vk = match from_binary(&handle_response.data.unwrap()).unwrap() {
        HandleAnswer::CreateViewingKey { key } => key,
        _ => panic!("Unexpected result from handle"),
    };

    (vk, deps)
}

fn extract_error_msg<T: Any>(error: StdResult<T>) -> String {
    match error {
        Ok(response) => {
            let bin_err = (&response as &dyn Any)
                .downcast_ref::<QueryResponse>()
                .expect("An error was expected, but no error could be extracted");
            match from_binary(bin_err).unwrap() {
                QueryAnswer::ViewingKeyError { msg } => msg,
                _ => panic!("Unexpected query answer"),
            }
        }
        Err(err) => match err {
            StdError::GenericErr { msg, .. } => msg,
            _ => panic!("Unexpected result from init"),
        },
    }
}

fn ensure_success(handle_result: HandleResponse) -> bool {
    let handle_result: HandleAnswer = from_binary(&handle_result.data.unwrap()).unwrap();

    match handle_result {
        HandleAnswer::Deposit { status }
        | HandleAnswer::Redeem { status }
        | HandleAnswer::Transfer { status }
        | HandleAnswer::Send { status }
        | HandleAnswer::Burn { status }
        | HandleAnswer::RegisterReceive { status }
        | HandleAnswer::SetViewingKey { status }
        | HandleAnswer::TransferFrom { status }
        | HandleAnswer::SendFrom { status }
        | HandleAnswer::BurnFrom { status }
        | HandleAnswer::Mint { status }
        | HandleAnswer::ChangeAdmin { status }
        | HandleAnswer::SetContractStatus { status }
        | HandleAnswer::SetMinters { status }
        | HandleAnswer::AddMinters { status }
        | HandleAnswer::RemoveMinters { status } => {
            matches!(status, ResponseStatus::Success { .. })
        }
        _ => panic!(
            "HandleAnswer not supported for success extraction: {:?}",
            handle_result
        ),
    }
}

// Init tests

#[test]
fn test_init_sanity() {
    let (init_result, deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(5000),
    }]);
    assert_eq!(init_result.unwrap(), InitResponse {
        messages: vec![],
        log: vec![
            log("token_address", "cosmos2contract"),
            log("token_code_hash", "")
        ]
    });

    let config = ReadonlyConfig::from_storage(&deps.storage);
    let constants = config.constants().unwrap();
    assert_eq!(config.total_supply(), 5000);
    assert_eq!(config.contract_status(), ContractStatusLevel::NormalRun);
    assert_eq!(constants.name, "sec-sec".to_string());
    assert_eq!(constants.admin, HumanAddr("admin".to_string()));
    assert_eq!(constants.symbol, "SECSEC".to_string());
    assert_eq!(constants.decimals, 8);
    assert_eq!(
        constants.prng_seed,
        sha_256("lolz fun yay".to_owned().as_bytes())
    );
    assert_eq!(constants.total_supply_is_public, false);
}

#[test]
fn test_init_with_config_sanity() {
    let (init_result, deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        true,
        true,
        true,
        true,
        0,
    );
    assert_eq!(init_result.unwrap(), InitResponse {
        messages: vec![],
        log: vec![
            log("token_address", "cosmos2contract"),
            log("token_code_hash", "")
        ]
    });

    let config = ReadonlyConfig::from_storage(&deps.storage);
    let constants = config.constants().unwrap();
    assert_eq!(config.total_supply(), 5000);
    assert_eq!(config.contract_status(), ContractStatusLevel::NormalRun);
    assert_eq!(constants.name, "sec-sec".to_string());
    assert_eq!(constants.admin, HumanAddr("admin".to_string()));
    assert_eq!(constants.symbol, "SECSEC".to_string());
    assert_eq!(constants.decimals, 8);
    assert_eq!(
        constants.prng_seed,
        sha_256("lolz fun yay".to_owned().as_bytes())
    );
    assert_eq!(constants.total_supply_is_public, false);
    assert_eq!(constants.deposit_is_enabled, true);
    assert_eq!(constants.redeem_is_enabled, true);
    assert_eq!(constants.mint_is_enabled, true);
    assert_eq!(constants.burn_is_enabled, true);
}

#[test]
fn test_total_supply_overflow() {
    let (init_result, _deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(u128::max_value()),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result, _deps) = init_helper(vec![
        InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(u128::max_value()),
        },
        InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: Uint128(1),
        },
    ]);
    let error = extract_error_msg(init_result);
    assert_eq!(
        error,
        "The sum of all initial balances exceeds the maximum possible total supply"
    );
}

// Handle tests

#[test]
fn test_handle_transfer() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(1000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let alice_canonical = deps
        .api
        .canonical_address(&HumanAddr("alice".to_string()))
        .unwrap();
    let balances = ReadonlyBalances::from_storage(&deps.storage);
    assert_eq!(5000 - 1000, balances.account_amount(&bob_canonical));
    assert_eq!(1000, balances.account_amount(&alice_canonical));

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(10000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient funds"));
}

#[test]
fn test_handle_send() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::RegisterReceive {
        code_hash: "this_is_a_hash_of_a_code".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("contract", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = HandleMsg::Send {
        recipient: HumanAddr("contract".to_string()),
        recipient_code_hash: None,
        amount: Uint128(100),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));
    assert!(result.messages.contains(&CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: HumanAddr("contract".to_string()),
        callback_code_hash: "this_is_a_hash_of_a_code".to_string(),
        msg: Snip20ReceiveMsg::new(
            HumanAddr("bob".to_string()),
            HumanAddr("bob".to_string()),
            Uint128(100),
            Some("my memo".to_string()),
            Some(to_binary("hey hey you you").unwrap())
        )
        .into_binary()
        .unwrap(),
        send: vec![]
    })));
}

#[test]
fn test_handle_send_with_code_hash() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let code_hash = "code_hash_of_recipient";

    let handle_msg = HandleMsg::Send {
        recipient: HumanAddr("contract".to_string()),
        recipient_code_hash: Some(code_hash.into()),
        amount: Uint128(100),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));
    assert!(result.messages.contains(&CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: HumanAddr("contract".to_string()),
        callback_code_hash: code_hash.into(),
        msg: Snip20ReceiveMsg::new(
            HumanAddr("bob".to_string()),
            HumanAddr("bob".to_string()),
            Uint128(100),
            Some("my memo".to_string()),
            Some(to_binary("hey hey you you").unwrap())
        )
        .into_binary()
        .unwrap(),
        send: vec![]
    })));
}

#[test]
fn test_handle_register_receive() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::RegisterReceive {
        code_hash: "this_is_a_hash_of_a_code".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("contract", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let hash = get_receiver_hash(&deps.storage, &HumanAddr("contract".to_string()))
        .unwrap()
        .unwrap();
    assert_eq!(hash, "this_is_a_hash_of_a_code".to_string());
}

#[test]
fn test_handle_create_viewing_key() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::CreateViewingKey {
        entropy: "".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let answer: HandleAnswer = from_binary(&handle_result.unwrap().data.unwrap()).unwrap();

    let key = match answer {
        HandleAnswer::CreateViewingKey { key } => key,
        _ => panic!("NOPE"),
    };
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let saved_vk = read_viewing_key(&deps.storage, &bob_canonical).unwrap();
    assert!(key.check_viewing_key(saved_vk.as_slice()));
}

#[test]
fn test_handle_set_viewing_key() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Set VK
    let handle_msg = HandleMsg::SetViewingKey {
        key: "hi lol".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let unwrapped_result: HandleAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&HandleAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    // Set valid VK
    let actual_vk = ViewingKey("x".to_string().repeat(VIEWING_KEY_SIZE));
    let handle_msg = HandleMsg::SetViewingKey {
        key: actual_vk.0.clone(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let unwrapped_result: HandleAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&HandleAnswer::SetViewingKey { status: ResponseStatus::Success }).unwrap(),
    );
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let saved_vk = read_viewing_key(&deps.storage, &bob_canonical).unwrap();
    assert!(actual_vk.check_viewing_key(&saved_vk));
}

#[test]
fn test_handle_transfer_from() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Transfer before allowance
    let handle_msg = HandleMsg::TransferFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Transfer more than allowance
    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: Some(1_571_797_420),
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = HandleMsg::TransferFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Transfer after allowance expired
    let handle_msg = HandleMsg::TransferFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(
        &mut deps,
        Env {
            block: BlockInfo {
                height: 12_345,
                time: 1_571_797_420,
                chain_id: "cosmos-testnet-14002".to_string(),
            },
            message: MessageInfo {
                sender: HumanAddr("bob".to_string()),
                sent_funds: vec![],
            },
            contract: ContractInfo {
                address: HumanAddr::from(MOCK_CONTRACT_ADDR),
            },
            contract_key: Some("".to_string()),
            contract_code_hash: "".to_string(),
        },
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = HandleMsg::TransferFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let alice_canonical = deps
        .api
        .canonical_address(&HumanAddr("alice".to_string()))
        .unwrap();
    let bob_balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
        .account_amount(&bob_canonical);
    let alice_balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
        .account_amount(&alice_canonical);
    assert_eq!(bob_balance, 5000 - 2000);
    assert_eq!(alice_balance, 2000);
    let total_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(total_supply, 5000);

    // Second send more than allowance
    let handle_msg = HandleMsg::TransferFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(1),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_send_from() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Send before allowance
    let handle_msg = HandleMsg::SendFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        recipient_code_hash: None,
        amount: Uint128(2500),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Send more than allowance
    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = HandleMsg::SendFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        recipient_code_hash: None,
        amount: Uint128(2500),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = HandleMsg::RegisterReceive {
        code_hash: "lolz".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("contract", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let send_msg = Binary::from(r#"{ "some_msg": { "some_key": "some_val" } }"#.as_bytes());
    let snip20_msg = Snip20ReceiveMsg::new(
        HumanAddr("alice".to_string()),
        HumanAddr("bob".to_string()),
        Uint128(2000),
        Some("my memo".to_string()),
        Some(send_msg.clone()),
    );
    let handle_msg = HandleMsg::SendFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("contract".to_string()),
        recipient_code_hash: None,
        amount: Uint128(2000),
        memo: Some("my memo".to_string()),
        msg: Some(send_msg),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    assert!(handle_result.unwrap().messages.contains(
        &snip20_msg
            .into_cosmos_msg("lolz".to_string(), HumanAddr("contract".to_string()))
            .unwrap()
    ));
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let contract_canonical = deps
        .api
        .canonical_address(&HumanAddr("contract".to_string()))
        .unwrap();
    let bob_balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
        .account_amount(&bob_canonical);
    let contract_balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
        .account_amount(&contract_canonical);
    assert_eq!(bob_balance, 5000 - 2000);
    assert_eq!(contract_balance, 2000);
    let total_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(total_supply, 5000);

    // Second send more than allowance
    let handle_msg = HandleMsg::SendFrom {
        owner: HumanAddr("bob".to_string()),
        recipient: HumanAddr("alice".to_string()),
        recipient_code_hash: None,
        amount: Uint128(1),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_send_from_with_code_hash() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let code_hash = "code_hash_of_recipient";

    let handle_msg = HandleMsg::SendFrom {
        owner: "bob".into(),
        recipient: HumanAddr("contract".to_string()),
        recipient_code_hash: Some(code_hash.into()),
        amount: Uint128(2000),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));
    assert!(result.messages.contains(&CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: HumanAddr("contract".to_string()),
        callback_code_hash: code_hash.into(),
        msg: Snip20ReceiveMsg::new(
            HumanAddr("alice".to_string()),
            "bob".into(),
            Uint128(2000),
            Some("my memo".to_string()),
            Some(to_binary("hey hey you you").unwrap())
        )
        .into_binary()
        .unwrap(),
        send: vec![]
    })));
}

#[test]
fn test_handle_burn_from() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("bob".to_string()),
            amount: Uint128(10000),
        }],
        false,
        false,
        false,
        true,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(10000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let handle_msg = HandleMsg::BurnFrom {
        owner: HumanAddr("bob".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    // Burn before allowance
    let handle_msg = HandleMsg::BurnFrom {
        owner: HumanAddr("bob".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Burn more than allowance
    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = HandleMsg::BurnFrom {
        owner: HumanAddr("bob".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = HandleMsg::BurnFrom {
        owner: HumanAddr("bob".to_string()),
        amount: Uint128(2000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let bob_balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
        .account_amount(&bob_canonical);
    assert_eq!(bob_balance, 10000 - 2000);
    let total_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(total_supply, 10000 - 2000);

    // Second burn more than allowance
    let handle_msg = HandleMsg::BurnFrom {
        owner: HumanAddr("bob".to_string()),
        amount: Uint128(1),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_batch_burn_from() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![
            InitialBalance {
                address: HumanAddr("bob".to_string()),
                amount: Uint128(10000),
            },
            InitialBalance {
                address: HumanAddr("jerry".to_string()),
                amount: Uint128(10000),
            },
            InitialBalance {
                address: HumanAddr("mike".to_string()),
                amount: Uint128(10000),
            },
        ],
        false,
        false,
        false,
        true,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(10000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let actions: Vec<_> = ["bob", "jerry", "mike"]
        .iter()
        .map(|name| batch::BurnFromAction {
            owner: HumanAddr(name.to_string()),
            amount: Uint128(2500),
            memo: None,
        })
        .collect();
    let handle_msg = HandleMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = handle(
        &mut deps_for_failure,
        mock_env("alice", &[]),
        handle_msg.clone(),
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    // Burn before allowance
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Burn more than allowance
    let allowance_size = 2000;
    for name in &["bob", "jerry", "mike"] {
        let handle_msg = HandleMsg::IncreaseAllowance {
            spender: HumanAddr("alice".to_string()),
            amount: Uint128(allowance_size),
            padding: None,
            expiration: None,
        };
        let handle_result = handle(&mut deps, mock_env(*name, &[]), handle_msg);
        assert!(
            handle_result.is_ok(),
            "handle() failed: {}",
            handle_result.err().unwrap()
        );
        let handle_msg = HandleMsg::BurnFrom {
            owner: HumanAddr(name.to_string()),
            amount: Uint128(2500),
            memo: None,
            padding: None,
        };
        let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
        let error = extract_error_msg(handle_result);
        assert!(error.contains("insufficient allowance"));
    }

    // Burn some of the allowance
    let actions: Vec<_> = [("bob", 200_u128), ("jerry", 300), ("mike", 400)]
        .iter()
        .map(|(name, amount)| batch::BurnFromAction {
            owner: HumanAddr(name.to_string()),
            amount: Uint128(*amount),
            memo: None,
        })
        .collect();

    let handle_msg = HandleMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    for (name, amount) in &[("bob", 200_u128), ("jerry", 300), ("mike", 400)] {
        let name_canon = deps
            .api
            .canonical_address(&HumanAddr(name.to_string()))
            .unwrap();
        let balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
            .account_amount(&name_canon);
        assert_eq!(balance, 10000 - amount);
    }
    let total_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(total_supply, 10000 * 3 - (200 + 300 + 400));

    // Burn the rest of the allowance
    let actions: Vec<_> = [("bob", 200_u128), ("jerry", 300), ("mike", 400)]
        .iter()
        .map(|(name, amount)| batch::BurnFromAction {
            owner: HumanAddr(name.to_string()),
            amount: Uint128(allowance_size - *amount),
            memo: None,
        })
        .collect();

    let handle_msg = HandleMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );
    for name in &["bob", "jerry", "mike"] {
        let name_canon = deps
            .api
            .canonical_address(&HumanAddr(name.to_string()))
            .unwrap();
        let balance = crate::state::ReadonlyBalances::from_storage(&deps.storage)
            .account_amount(&name_canon);
        assert_eq!(balance, 10000 - allowance_size);
    }
    let total_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(total_supply, 3 * (10000 - allowance_size));

    // Second burn more than allowance
    let actions: Vec<_> = ["bob", "jerry", "mike"]
        .iter()
        .map(|name| batch::BurnFromAction {
            owner: HumanAddr(name.to_string()),
            amount: Uint128(1),
            memo: None,
        })
        .collect();
    let handle_msg = HandleMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("alice", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_decrease_allowance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::DecreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let alice_canonical = deps
        .api
        .canonical_address(&HumanAddr("alice".to_string()))
        .unwrap();

    let allowance = read_allowance(&deps.storage, &bob_canonical, &alice_canonical).unwrap();
    assert_eq!(
        allowance,
        crate::state::Allowance {
            amount: 0,
            expiration: None
        }
    );

    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = HandleMsg::DecreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(50),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let allowance = read_allowance(&deps.storage, &bob_canonical, &alice_canonical).unwrap();
    assert_eq!(
        allowance,
        crate::state::Allowance {
            amount: 1950,
            expiration: None
        }
    );
}

#[test]
fn test_handle_increase_allowance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let bob_canonical = deps
        .api
        .canonical_address(&HumanAddr("bob".to_string()))
        .unwrap();
    let alice_canonical = deps
        .api
        .canonical_address(&HumanAddr("alice".to_string()))
        .unwrap();

    let allowance = read_allowance(&deps.storage, &bob_canonical, &alice_canonical).unwrap();
    assert_eq!(
        allowance,
        crate::state::Allowance {
            amount: 2000,
            expiration: None
        }
    );

    let handle_msg = HandleMsg::IncreaseAllowance {
        spender: HumanAddr("alice".to_string()),
        amount: Uint128(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let allowance = read_allowance(&deps.storage, &bob_canonical, &alice_canonical).unwrap();
    assert_eq!(
        allowance,
        crate::state::Allowance {
            amount: 4000,
            expiration: None
        }
    );
}

#[test]
fn test_handle_change_admin() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::ChangeAdmin {
        address: HumanAddr("bob".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let admin = ReadonlyConfig::from_storage(&deps.storage)
        .constants()
        .unwrap()
        .admin;
    assert_eq!(admin, HumanAddr("bob".to_string()));
}

#[test]
fn test_handle_set_contract_status() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("admin".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::SetContractStatus {
        level: ContractStatusLevel::StopAll,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let contract_status = ReadonlyConfig::from_storage(&deps.storage).contract_status();
    assert!(matches!(
        contract_status,
        ContractStatusLevel::StopAll { .. }
    ));
}

#[test]
fn test_handle_redeem() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("butler".to_string()),
            amount: Uint128(5000),
        }],
        false,
        true,
        false,
        false,
        1000,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result_no_reserve, mut deps_no_reserve) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("butler".to_string()),
            amount: Uint128(5000),
        }],
        false,
        true,
        false,
        false,
        0,
    );
    assert!(
        init_result_no_reserve.is_ok(),
        "Init failed: {}",
        init_result_no_reserve.err().unwrap()
    );

    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("butler".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when redeem disabled
    let handle_msg = HandleMsg::Redeem {
        amount: Uint128(1000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("butler", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Redeem functionality is not enabled for this token."));

    // try to redeem when contract has 0 balance
    let handle_msg = HandleMsg::Redeem {
        amount: Uint128(1000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps_no_reserve, mock_env("butler", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(
        "You are trying to redeem for more SCRT than the token has in its deposit reserve."
    ));

    let handle_msg = HandleMsg::Redeem {
        amount: Uint128(1000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("butler", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let balances = ReadonlyBalances::from_storage(&deps.storage);
    let canonical = deps
        .api
        .canonical_address(&HumanAddr("butler".to_string()))
        .unwrap();
    assert_eq!(balances.account_amount(&canonical), 4000)
}

#[test]
fn test_handle_deposit() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        true,
        false,
        false,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when deposit disabled
    let handle_msg = HandleMsg::Deposit { padding: None };
    let handle_result = handle(
        &mut deps_for_failure,
        mock_env(
            "lebron",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128(1000),
            }],
        ),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Deposit functionality is not enabled for this token."));

    let handle_msg = HandleMsg::Deposit { padding: None };
    let handle_result = handle(
        &mut deps,
        mock_env(
            "lebron",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128(1000),
            }],
        ),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let balances = ReadonlyBalances::from_storage(&deps.storage);
    let canonical = deps
        .api
        .canonical_address(&HumanAddr("lebron".to_string()))
        .unwrap();
    assert_eq!(balances.account_amount(&canonical), 6000)
}

#[test]
fn test_handle_burn() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        false,
        true,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let handle_msg = HandleMsg::Burn {
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("lebron", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    let supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    let burn_amount: u128 = 100;
    let handle_msg = HandleMsg::Burn {
        amount: Uint128(burn_amount),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("lebron", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let new_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(new_supply, supply - burn_amount);
}

#[test]
fn test_handle_mint() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        true,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );
    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try to mint when mint is disabled
    let mint_amount: u128 = 100;
    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("lebron".to_string()),
        amount: Uint128(mint_amount),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    let mint_amount: u128 = 100;
    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("lebron".to_string()),
        amount: Uint128(mint_amount),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let new_supply = ReadonlyConfig::from_storage(&deps.storage).total_supply();
    assert_eq!(new_supply, supply + mint_amount);
}

#[test]
fn test_handle_admin_commands() {
    let admin_err = "Admin commands can only be run from admin address".to_string();
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        true,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let pause_msg = HandleMsg::SetContractStatus {
        level: ContractStatusLevel::StopAllButRedeems,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("not_admin", &[]), pause_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(&admin_err.clone()));

    let mint_msg = HandleMsg::AddMinters {
        minters: vec![HumanAddr("not_admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("not_admin", &[]), mint_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(&admin_err.clone()));

    let mint_msg = HandleMsg::RemoveMinters {
        minters: vec![HumanAddr("admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("not_admin", &[]), mint_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(&admin_err.clone()));

    let mint_msg = HandleMsg::SetMinters {
        minters: vec![HumanAddr("not_admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("not_admin", &[]), mint_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(&admin_err.clone()));

    let change_admin_msg = HandleMsg::ChangeAdmin {
        address: HumanAddr("not_admin".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("not_admin", &[]), change_admin_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains(&admin_err.clone()));
}

#[test]
fn test_handle_pause_with_withdrawals() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("lebron".to_string()),
            amount: Uint128(5000),
        }],
        false,
        true,
        false,
        false,
        5000,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let pause_msg = HandleMsg::SetContractStatus {
        level: ContractStatusLevel::StopAllButRedeems,
        padding: None,
    };

    let handle_result = handle(&mut deps, mock_env("admin", &[]), pause_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let send_msg = HandleMsg::Transfer {
        recipient: HumanAddr("account".to_string()),
        amount: Uint128(123),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "This contract is stopped and this action is not allowed".to_string()
    );

    let withdraw_msg = HandleMsg::Redeem {
        amount: Uint128(5000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("lebron", &[]), withdraw_msg);
    assert!(
        handle_result.is_ok(),
        "Withdraw failed: {}",
        handle_result.err().unwrap()
    );
}

#[test]
fn test_handle_pause_all() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("lebron".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let pause_msg = HandleMsg::SetContractStatus {
        level: ContractStatusLevel::StopAll,
        padding: None,
    };

    let handle_result = handle(&mut deps, mock_env("admin", &[]), pause_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let send_msg = HandleMsg::Transfer {
        recipient: HumanAddr("account".to_string()),
        amount: Uint128(123),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "This contract is stopped and this action is not allowed".to_string()
    );

    let withdraw_msg = HandleMsg::Redeem {
        amount: Uint128(5000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("lebron", &[]), withdraw_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "This contract is stopped and this action is not allowed".to_string()
    );
}

#[test]
fn test_handle_set_minters() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("bob".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        true,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );
    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = HandleMsg::SetMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = HandleMsg::SetMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Admin commands can only be run from admin address"));

    let handle_msg = HandleMsg::SetMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));
}

#[test]
fn test_handle_add_minters() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("bob".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        true,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );
    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = HandleMsg::AddMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = HandleMsg::AddMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Admin commands can only be run from admin address"));

    let handle_msg = HandleMsg::AddMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));
}

#[test]
fn test_handle_remove_minters() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("bob".to_string()),
            amount: Uint128(5000),
        }],
        false,
        false,
        true,
        false,
        0,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );
    let (init_result_for_failure, mut deps_for_failure) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = HandleMsg::RemoveMinters {
        minters: vec![HumanAddr("bob".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps_for_failure, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = HandleMsg::RemoveMinters {
        minters: vec![HumanAddr("admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Admin commands can only be run from admin address"));

    let handle_msg = HandleMsg::RemoveMinters {
        minters: vec![HumanAddr("admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    // Removing another extra time to ensure nothing funky happens
    let handle_msg = HandleMsg::RemoveMinters {
        minters: vec![HumanAddr("admin".to_string())],
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));
}

// Query tests

#[test]
fn test_authenticated_queries() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("giannis".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let no_vk_yet_query_msg = QueryMsg::Balance {
        address: HumanAddr("giannis".to_string()),
        key: "no_vk_yet".to_string(),
    };
    let query_result = query(&deps, no_vk_yet_query_msg);
    let error = extract_error_msg(query_result);
    assert_eq!(
        error,
        "Wrong viewing key for this address or viewing key not set".to_string()
    );

    let create_vk_msg = HandleMsg::CreateViewingKey {
        entropy: "34".to_string(),
        padding: None,
    };
    let handle_response = handle(&mut deps, mock_env("giannis", &[]), create_vk_msg).unwrap();
    let vk = match from_binary(&handle_response.data.unwrap()).unwrap() {
        HandleAnswer::CreateViewingKey { key } => key,
        _ => panic!("Unexpected result from handle"),
    };

    let query_balance_msg = QueryMsg::Balance {
        address: HumanAddr("giannis".to_string()),
        key: vk.0,
    };

    let query_response = query(&deps, query_balance_msg).unwrap();
    let balance = match from_binary(&query_response).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected result from query"),
    };
    assert_eq!(balance, Uint128(5000));

    let wrong_vk_query_msg = QueryMsg::Balance {
        address: HumanAddr("giannis".to_string()),
        key: "wrong_vk".to_string(),
    };
    let query_result = query(&deps, wrong_vk_query_msg);
    let error = extract_error_msg(query_result);
    assert_eq!(
        error,
        "Wrong viewing key for this address or viewing key not set".to_string()
    );
}

#[test]
fn test_query_token_info() {
    let init_name = "sec-sec".to_string();
    let init_admin = HumanAddr("admin".to_string());
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 8;
    let init_config: InitConfig = from_binary(&Binary::from(
        r#"{ "public_total_supply": true }"#.as_bytes(),
    ))
    .unwrap();
    let init_supply = Uint128(5000);

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);
    let init_msg = InitMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: init_supply,
        }]),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None
    };
    let init_result = init(&mut deps, env, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::TokenInfo {};
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::TokenInfo {
            name,
            symbol,
            decimals,
            total_supply,
        } => {
            assert_eq!(name, init_name);
            assert_eq!(symbol, init_symbol);
            assert_eq!(decimals, init_decimals);
            assert_eq!(total_supply, Some(Uint128(5000)));
        }
        _ => panic!("unexpected"),
    }
}

#[test]
fn test_query_exchange_rate() {
    // test more dec than SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = HumanAddr("admin".to_string());
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 8;

    let init_supply = Uint128(5000);

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);
    let init_config: InitConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{}}}",
            true, true, false, false, false
        )
        .as_bytes(),
    ))
    .unwrap();
    let init_msg = InitMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: init_supply,
        }]),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None
    };
    let init_result = init(&mut deps, env, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128(100));
            assert_eq!(denom, "SCRT");
        }
        _ => panic!("unexpected"),
    }

    // test same number of decimals as SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = HumanAddr("admin".to_string());
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 6;

    let init_supply = Uint128(5000);

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);
    let init_config: InitConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{}}}",
            true, true, false, false, false
        )
        .as_bytes(),
    ))
    .unwrap();
    let init_msg = InitMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: init_supply,
        }]),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None
    };
    let init_result = init(&mut deps, env, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128(1));
            assert_eq!(denom, "SCRT");
        }
        _ => panic!("unexpected"),
    }

    // test less decimal places than SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = HumanAddr("admin".to_string());
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 3;

    let init_supply = Uint128(5000);

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);
    let init_config: InitConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{}}}",
            true, true, false, false, false
        )
        .as_bytes(),
    ))
    .unwrap();
    let init_msg = InitMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: init_supply,
        }]),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None
    };
    let init_result = init(&mut deps, env, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128(1000));
            assert_eq!(denom, "SECSEC");
        }
        _ => panic!("unexpected"),
    }

    // test depost/redeem not enabled
    let init_name = "sec-sec".to_string();
    let init_admin = HumanAddr("admin".to_string());
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 3;

    let init_supply = Uint128(5000);

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env("instantiator", &[]);
    let init_msg = InitMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr("giannis".to_string()),
            amount: init_supply,
        }]),
        initial_allowances: None,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: None,
        callback: None
    };
    let init_result = init(&mut deps, env, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128(0));
            assert_eq!(denom, String::new());
        }
        _ => panic!("unexpected"),
    }
}

#[test]
fn test_query_allowance() {
    const ADMIN:   &str = "giannis";
    const OWNER:   &str = "kobe";
    const SPENDER: &str = "lebron";

    let mut deps = mock_dependencies(20, &[]);
    let env = mock_env(ADMIN, &[]);

    let init_msg = InitMsg {
        name: "sec-sec".to_string(),
        admin: Some(HumanAddr("admin".to_string())),
        symbol: "SECSEC".to_string(),
        decimals: 8,
        initial_balances: Some(vec![InitialBalance {
            address: HumanAddr(ADMIN.to_string()),
            amount: Uint128(5000),
        }]),
        initial_allowances: Some(vec![
            InitialAllowance {
                owner: OWNER.into(),
                spender: SPENDER.into(),
                amount: Uint128(2000),
                expiration: None
            }
        ]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: None,
        callback: None
    };

    init(&mut deps, env, init_msg).unwrap();

    let vk1 = ViewingKey("key1".to_string());
    let vk2 = ViewingKey("key2".to_string());

    let query_msg = QueryMsg::Allowance {
        owner: HumanAddr(OWNER.to_string()),
        spender: HumanAddr(SPENDER.to_string()),
        key: vk1.0.clone(),
    };
    let query_result = query(&deps, query_msg);
    assert!(
        query_result.is_ok(),
        "Query failed: {}",
        query_result.err().unwrap()
    );
    let error = extract_error_msg(query_result);
    assert!(error.contains("Wrong viewing key"));

    let handle_msg = HandleMsg::SetViewingKey {
        key: vk1.0.clone(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env(SPENDER, &[]), handle_msg);
    let unwrapped_result: HandleAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&HandleAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let handle_msg = HandleMsg::SetViewingKey {
        key: vk2.0.clone(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env(OWNER, &[]), handle_msg);
    let unwrapped_result: HandleAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&HandleAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let query_msg = QueryMsg::Allowance {
        owner: HumanAddr(OWNER.to_string()),
        spender: HumanAddr(SPENDER.to_string()),
        key: vk1.0.clone(),
    };
    let query_result = query(&deps, query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128(2000));
    println!("{}", &allowance);

    let query_msg = QueryMsg::Allowance {
        owner: HumanAddr(OWNER.to_string()),
        spender: HumanAddr(SPENDER.to_string()),
        key: vk2.0.clone(),
    };
    let query_result = query(&deps, query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128(2000));

    let query_msg = QueryMsg::Allowance {
        owner: HumanAddr(SPENDER.to_string()),
        spender: HumanAddr(OWNER.to_string()),
        key: vk2.0.clone(),
    };
    let query_result = query(&deps, query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128(0));
}

#[test]
fn test_query_balance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let unwrapped_result: HandleAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&HandleAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let query_msg = QueryMsg::Balance {
        address: HumanAddr("bob".to_string()),
        key: "wrong_key".to_string(),
    };
    let query_result = query(&deps, query_msg);
    let error = extract_error_msg(query_result);
    assert!(error.contains("Wrong viewing key"));

    let query_msg = QueryMsg::Balance {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
    };
    let query_result = query(&deps, query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128(5000));
}

#[test]
fn test_query_transfer_history() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: HumanAddr("bob".to_string()),
        amount: Uint128(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(1000),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("banana".to_string()),
        amount: Uint128(500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("mango".to_string()),
        amount: Uint128(2500),
        memo: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: None,
        page_size: 0,
    };
    let query_result = query(&deps, query_msg);
    // let a: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    // println!("{:?}", a);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert!(transfers.is_empty());

    let query_msg = QueryMsg::TransferHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(&deps, query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 3);

    let query_msg = QueryMsg::TransferHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: None,
        page_size: 2,
    };
    let query_result = query(&deps, query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 2);

    let query_msg = QueryMsg::TransferHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: Some(1),
        page_size: 2,
    };
    let query_result = query(&deps, query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 1);
}

#[test]
fn test_query_transaction_history() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: HumanAddr("bob".to_string()),
            amount: Uint128(10000),
        }],
        true,
        true,
        true,
        true,
        1000,
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = HandleMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Burn {
        amount: Uint128(1),
        memo: Some("my burn message".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = HandleMsg::Redeem {
        amount: Uint128(1000),
        denom: None,
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = HandleMsg::Mint {
        recipient: HumanAddr("bob".to_string()),
        amount: Uint128(100),
        memo: Some("my mint message".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("admin", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = HandleMsg::Deposit { padding: None };
    let handle_result = handle(
        &mut deps,
        mock_env(
            "bob",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128(1000),
            }],
        ),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "handle() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("alice".to_string()),
        amount: Uint128(1000),
        memo: Some("my transfer message #1".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("banana".to_string()),
        amount: Uint128(500),
        memo: Some("my transfer message #2".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = HandleMsg::Transfer {
        recipient: HumanAddr("mango".to_string()),
        amount: Uint128(2500),
        memo: Some("my transfer message #3".to_string()),
        padding: None,
    };
    let handle_result = handle(&mut deps, mock_env("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(&deps, query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 3);

    let query_msg = QueryMsg::TransactionHistory {
        address: HumanAddr("bob".to_string()),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(&deps, query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransactionHistory { txs, .. } => txs,
        other => panic!("Unexpected: {:?}", other),
    };

    use crate::transaction_history::{RichTx, TxAction};
    let expected_transfers = [
        RichTx {
            id: 8,
            action: TxAction::Transfer {
                from: HumanAddr("bob".to_string()),
                sender: HumanAddr("bob".to_string()),
                recipient: HumanAddr("mango".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(2500),
            },
            memo: Some("my transfer message #3".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 7,
            action: TxAction::Transfer {
                from: HumanAddr("bob".to_string()),
                sender: HumanAddr("bob".to_string()),
                recipient: HumanAddr("banana".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(500),
            },
            memo: Some("my transfer message #2".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 6,
            action: TxAction::Transfer {
                from: HumanAddr("bob".to_string()),
                sender: HumanAddr("bob".to_string()),
                recipient: HumanAddr("alice".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(1000),
            },
            memo: Some("my transfer message #1".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 5,
            action: TxAction::Deposit {},
            coins: Coin {
                denom: "uscrt".to_string(),
                amount: Uint128(1000),
            },
            memo: None,
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 4,
            action: TxAction::Mint {
                minter: HumanAddr("admin".to_string()),
                recipient: HumanAddr("bob".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(100),
            },
            memo: Some("my mint message".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 3,
            action: TxAction::Redeem {},
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(1000),
            },
            memo: None,
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 2,
            action: TxAction::Burn {
                burner: HumanAddr("bob".to_string()),
                owner: HumanAddr("bob".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(1),
            },
            memo: Some("my burn message".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 1,
            action: TxAction::Mint {
                minter: HumanAddr("admin".to_string()),
                recipient: HumanAddr("bob".to_string()),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128(10000),
            },

            memo: Some("Initial Balance".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
    ];

    assert_eq!(transfers, expected_transfers);
}

#[test]
fn test_symbol_validation() {
    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: false,
        allow_numeric: false,
        allowed_special: None
    };

    assert_valid_symbol("TOKENA", config.clone()).unwrap();
    assert_valid_symbol("TOK", config.clone()).unwrap();
    assert_valid_symbol("TO", config.clone()).unwrap_err();
    assert_valid_symbol("TOOLONG", config.clone()).unwrap_err();
    assert_valid_symbol("TOken", config.clone()).unwrap_err();
    assert_valid_symbol("T0K3N", config.clone()).unwrap_err();
    assert_valid_symbol("TOK-EN", config).unwrap_err();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: true,
        allow_numeric: false,
        allowed_special: None
    };

    assert_valid_symbol("TOKena", config.clone()).unwrap();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: false,
        allow_lower: true,
        allow_numeric: true,
        allowed_special: None
    };

    assert_valid_symbol("t0k3n", config.clone()).unwrap();
    assert_valid_symbol("T0K3N", config).unwrap_err();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: false,
        allow_numeric: true,
        allowed_special: Some(vec![ b'-', b'@' ])
    };

    assert_valid_symbol("T@K3N-", config.clone()).unwrap();
    assert_valid_symbol("!@K3N-", config).unwrap_err();
}

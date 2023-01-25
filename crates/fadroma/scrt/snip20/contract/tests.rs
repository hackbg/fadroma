#![cfg(test)]

use crate::{
    crypto::sha_256,
    admin,
    scrt::{
        vk::{ViewingKey, ViewingKeyHashed},
        snip20::client::msg::*
    },
    cosmwasm_std::{
        from_binary,
        testing::{
            mock_dependencies, mock_dependencies_with_balance, mock_env, mock_info, MockApi,
            MockQuerier, MockStorage,
        },
        to_binary, Addr, Api, Binary, Coin, CosmosMsg, Deps, DepsMut, Env, MessageInfo, OwnedDeps,
        QueryResponse, ReplyOn, Response, StdError, StdResult, SubMsg, Uint128, WasmMsg,
    },
};

use super::{
    assert_valid_symbol,
    receiver::Snip20ReceiveMsg,
    msg::{InitialBalance, InitConfig},
    state::*,
    DefaultSnip20Impl, SymbolValidation,
};
use std::any::Any;

use super::msg::InstantiateMsg;

fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    super::snip20_instantiate(deps, env, info, msg, DefaultSnip20Impl)
}

fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    super::snip20_execute(deps, env, info, msg, DefaultSnip20Impl)
}

fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    super::snip20_query(deps, env, msg, DefaultSnip20Impl)
}

// Helper functions
fn init_helper(
    initial_balances: Vec<InitialBalance>,
) -> (
    StdResult<Response>,
    OwnedDeps<MockStorage, MockApi, MockQuerier>,
) {
    let mut deps = mock_dependencies();
    let env = mock_env();
    let info = mock_info("instantiator", &[]);

    let init_msg = InstantiateMsg {
        name: "sec-sec".to_string(),
        admin: Some("admin".to_string()),
        symbol: "SECSEC".to_string(),
        decimals: 8,
        initial_balances: Some(initial_balances),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: None,
        callback: None,
    };

    (instantiate(deps.as_mut(), env, info, init_msg), deps)
}

fn init_helper_with_config(
    initial_balances: Vec<InitialBalance>,
    enable_deposit: bool,
    enable_redeem: bool,
    enable_mint: bool,
    enable_burn: bool,
    contract_bal: u128,
) -> (
    StdResult<Response>,
    OwnedDeps<MockStorage, MockApi, MockQuerier>,
) {
    let mut deps = mock_dependencies_with_balance(&[Coin {
        denom: "uscrt".to_string(),
        amount: Uint128::new(contract_bal),
    }]);

    let env = mock_env();
    let info = mock_info("instantiator", &[]);

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

    let init_msg = InstantiateMsg {
        name: "sec-sec".to_string(),
        admin: Some("admin".to_string()),
        symbol: "SECSEC".to_string(),
        decimals: 8,
        initial_balances: Some(initial_balances),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None,
    };

    (instantiate(deps.as_mut(), env, info, init_msg), deps)
}

/// Will return a ViewingKey only for the first account in `initial_balances`
fn _auth_query_helper(
    initial_balances: Vec<InitialBalance>,
) -> (ViewingKey, OwnedDeps<MockStorage, MockApi, MockQuerier>) {
    let (init_result, mut deps) = init_helper(initial_balances.clone());

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let account = initial_balances[0].address.clone();
    let create_vk_msg = ExecuteMsg::CreateViewingKey {
        entropy: "42".to_string(),
        padding: None,
    };

    let handle_response = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(&account, &[]),
        create_vk_msg,
    )
    .unwrap();

    let vk = match from_binary(&handle_response.data.unwrap()).unwrap() {
        ExecuteAnswer::CreateViewingKey { key } => key,
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

fn ensure_success(handle_result: Response) -> bool {
    let handle_result: ExecuteAnswer = from_binary(&handle_result.data.unwrap()).unwrap();

    match handle_result {
        ExecuteAnswer::Deposit { status }
        | ExecuteAnswer::Redeem { status }
        | ExecuteAnswer::Transfer { status }
        | ExecuteAnswer::Send { status }
        | ExecuteAnswer::Burn { status }
        | ExecuteAnswer::RegisterReceive { status }
        | ExecuteAnswer::SetViewingKey { status }
        | ExecuteAnswer::TransferFrom { status }
        | ExecuteAnswer::SendFrom { status }
        | ExecuteAnswer::BurnFrom { status }
        | ExecuteAnswer::Mint { status }
        | ExecuteAnswer::ChangeAdmin { status }
        | ExecuteAnswer::SetContractStatus { status }
        | ExecuteAnswer::SetMinters { status }
        | ExecuteAnswer::AddMinters { status }
        | ExecuteAnswer::RemoveMinters { status } => {
            matches!(status, ResponseStatus::Success { .. })
        }
        _ => panic!(
            "ExecuteAnswer not supported for success extraction: {:?}",
            handle_result
        ),
    }
}

// Init tests

#[test]
fn test_init_sanity() {
    let (init_result, deps) = init_helper(vec![InitialBalance {
        address: "lebron".into(),
        amount: Uint128::new(5000),
    }]);
    assert_eq!(
        init_result.unwrap(),
        Response::new()
            .add_attribute("token_address", "cosmos2contract")
            .add_attribute("token_code_hash", "")
    );

    let storage = deps.as_ref().storage;
    let constants = CONSTANTS.load_or_error(storage).unwrap();

    assert_eq!(TOTAL_SUPPLY.load_or_default(storage).unwrap(), Uint128::new(5000));
    assert_eq!(
        STATUS.load_or_error(storage).unwrap(),
        ContractStatusLevel::NormalRun
    );
    assert_eq!(constants.name, "sec-sec".to_string());
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
            address: "lebron".into(),
            amount: Uint128::new(5000),
        }],
        true,
        true,
        true,
        true,
        0,
    );
    assert_eq!(
        init_result.unwrap(),
        Response::new()
            .add_attribute("token_address", "cosmos2contract")
            .add_attribute("token_code_hash", "")
    );

    let storage = deps.as_ref().storage;
    let constants = CONSTANTS.load_or_error(storage).unwrap();
    assert_eq!(TOTAL_SUPPLY.load_or_default(storage).unwrap(), Uint128::new(5000));
    assert_eq!(
        STATUS.load_or_error(storage).unwrap(),
        ContractStatusLevel::NormalRun
    );
    assert_eq!(constants.name, "sec-sec".to_string());
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
        address: "lebron".into(),
        amount: Uint128::new(u128::max_value()),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let (init_result, _deps) = init_helper(vec![
        InitialBalance {
            address: "lebron".into(),
            amount: Uint128::new(u128::max_value()),
        },
        InitialBalance {
            address: "giannis".into(),
            amount: Uint128::new(1),
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
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "alice".to_string(),
        amount: Uint128::new(1000),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);

    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let storage = deps.as_ref().storage;

    let acc_bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());
    let acc_alice = Account::of(deps.api.addr_canonicalize("alice").unwrap());

    assert_eq!(5000 - 1000, acc_bob.balance(storage).unwrap().u128());
    assert_eq!(1000, acc_alice.balance(storage).unwrap().u128());

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "alice".to_string(),
        amount: Uint128::new(10000),
        memo: None,
        padding: None,
    };

    let error = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg).unwrap_err();

    assert!(matches!(error, StdError::Overflow { .. }));
}

#[test]
fn test_handle_send() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::RegisterReceive {
        code_hash: "this_is_a_hash_of_a_code".to_string(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("contract", &[]),
        handle_msg,
    );
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = ExecuteMsg::Send {
        recipient: "contract".to_string(),
        recipient_code_hash: None,
        amount: Uint128::new(100),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };

    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));

    let messages: Vec<CosmosMsg> = result.messages.into_iter().map(|x| x.msg).collect();

    assert!(messages.contains(&CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: "contract".to_string(),
        code_hash: "this_is_a_hash_of_a_code".to_string(),
        msg: Snip20ReceiveMsg::new(
            Addr::unchecked("bob"),
            Addr::unchecked("bob"),
            Uint128::new(100),
            Some("my memo".to_string()),
            Some(to_binary("hey hey you you").unwrap())
        )
        .into_binary()
        .unwrap(),
        funds: vec![]
    })));
}

#[test]
fn test_handle_send_with_code_hash() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".into(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let code_hash = "code_hash_of_recipient";

    let handle_msg = ExecuteMsg::Send {
        recipient: "contract".into(),
        recipient_code_hash: Some(code_hash.into()),
        amount: Uint128::new(100),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));
    let id = 0;
    assert!(result.messages.contains(&SubMsg {
        id,
        msg: CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: "contract".to_string(),
            code_hash: code_hash.into(),
            msg: Snip20ReceiveMsg::new(
                Addr::unchecked("bob".to_string()),
                Addr::unchecked("bob".to_string()),
                Uint128::new(100),
                Some("my memo".to_string()),
                Some(to_binary("hey hey you you").unwrap())
            )
            .into_binary()
            .unwrap(),
            funds: vec![],
        })
        .into(),
        reply_on: match id {
            0 => ReplyOn::Never,
            _ => ReplyOn::Always,
        },
        gas_limit: None,
    }));
}

#[test]
fn test_handle_register_receive() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::RegisterReceive {
        code_hash: "this_is_a_hash_of_a_code".to_string(),
        padding: None,
    };

    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("contract", &[]),
        handle_msg,
    );
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let account = Account::of(deps.api.addr_canonicalize("contract").unwrap());

    let hash = account
        .receiver_hash(deps.as_ref().storage)
        .unwrap()
        .unwrap();

    assert_eq!(hash, "this_is_a_hash_of_a_code".to_string());
}

#[test]
fn test_handle_create_viewing_key() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::CreateViewingKey {
        entropy: "".to_string(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let answer: ExecuteAnswer = from_binary(&handle_result.unwrap().data.unwrap()).unwrap();

    let key = match answer {
        ExecuteAnswer::CreateViewingKey { key } => key,
        _ => panic!("NOPE"),
    };

    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());

    let saved_vk = bob.viewing_key(deps.as_ref().storage).unwrap().unwrap();
    assert!(key.check_hashed(&saved_vk));
}

#[test]
fn test_handle_set_viewing_key() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Set VK
    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "hi lol".to_string(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let unwrapped_result: ExecuteAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&ExecuteAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    // Set valid VK
    let actual_vk = ViewingKey("x".to_string().repeat(ViewingKeyHashed::SIZE));
    let handle_msg = ExecuteMsg::SetViewingKey {
        key: actual_vk.0.clone(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let unwrapped_result: ExecuteAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&ExecuteAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());

    let saved_vk = bob.viewing_key(deps.as_ref().storage).unwrap().unwrap();
    assert!(actual_vk.check_hashed(&saved_vk));
}

#[test]
fn test_handle_transfer_from() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Transfer before allowance
    let handle_msg = ExecuteMsg::TransferFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Transfer more than allowance
    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: Some(1_571_797_420),
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = ExecuteMsg::TransferFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Transfer after allowance expired
    let handle_msg = ExecuteMsg::TransferFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        amount: Uint128::new(2000),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = ExecuteMsg::TransferFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        amount: Uint128::new(2000),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());
    let alice = Account::of(deps.api.addr_canonicalize("alice").unwrap());

    let bob_balance = bob.balance(deps.as_ref().storage).unwrap().u128();
    let alice_balance = alice.balance(deps.as_ref().storage).unwrap().u128();

    assert_eq!(bob_balance, 5000 - 2000);
    assert_eq!(alice_balance, 2000);

    let total_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(total_supply.u128(), 5000);

    // Second send more than allowance
    let handle_msg = ExecuteMsg::TransferFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        amount: Uint128::new(1),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_send_from() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    // Send before allowance
    let handle_msg = ExecuteMsg::SendFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        recipient_code_hash: None,
        amount: Uint128::new(2500),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Send more than allowance
    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = ExecuteMsg::SendFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        recipient_code_hash: None,
        amount: Uint128::new(2500),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = ExecuteMsg::RegisterReceive {
        code_hash: "lolz".to_string(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("contract", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let send_msg = Binary::from(r#"{ "some_msg": { "some_key": "some_val" } }"#.as_bytes());
    let snip20_msg = Snip20ReceiveMsg::new(
        Addr::unchecked("alice"),
        Addr::unchecked("bob"),
        Uint128::new(2000),
        Some("my memo".to_string()),
        Some(send_msg.clone()),
    );
    let handle_msg = ExecuteMsg::SendFrom {
        owner: "bob".to_string(),
        recipient: "contract".to_string(),
        recipient_code_hash: None,
        amount: Uint128::new(2000),
        memo: Some("my memo".to_string()),
        msg: Some(send_msg),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let messages: Vec<CosmosMsg> = handle_result
        .unwrap()
        .messages
        .into_iter()
        .map(|x| x.msg)
        .collect();
    assert!(messages.contains(
        &snip20_msg
            .into_cosmos_msg("lolz".to_string(), "contract".to_string())
            .unwrap()
    ));
    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());
    let contract = Account::of(deps.api.addr_canonicalize("contract").unwrap());

    let bob_balance = bob.balance(deps.as_ref().storage).unwrap().u128();
    let contract_balance = contract.balance(deps.as_ref().storage).unwrap().u128();
    assert_eq!(bob_balance, 5000 - 2000);
    assert_eq!(contract_balance, 2000);

    let total_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(total_supply, Uint128::new(5000));

    // Second send more than allowance
    let handle_msg = ExecuteMsg::SendFrom {
        owner: "bob".to_string(),
        recipient: "alice".to_string(),
        recipient_code_hash: None,
        amount: Uint128::new(1),
        memo: None,
        msg: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_send_from_with_code_hash() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".into(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".into(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let code_hash = "code_hash_of_recipient";

    let handle_msg = ExecuteMsg::SendFrom {
        owner: "bob".into(),
        recipient: "contract".into(),
        recipient_code_hash: Some(code_hash.into()),
        amount: Uint128::new(2000),
        memo: Some("my memo".to_string()),
        padding: None,
        msg: Some(to_binary("hey hey you you").unwrap()),
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let result = handle_result.unwrap();
    assert!(ensure_success(result.clone()));
    let id = 0;
    assert!(result.messages.contains(&SubMsg {
        id,
        msg: CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: "contract".into(),
            code_hash: code_hash.into(),
            msg: Snip20ReceiveMsg::new(
                Addr::unchecked("alice".to_string()),
                Addr::unchecked("bob".to_string()),
                Uint128::new(2000),
                Some("my memo".to_string()),
                Some(to_binary("hey hey you you").unwrap())
            )
            .into_binary()
            .unwrap(),
            funds: vec![]
        })
        .into(),
        reply_on: match id {
            0 => ReplyOn::Never,
            _ => ReplyOn::Always,
        },
        gas_limit: None,
    }));
}

#[test]
fn test_handle_burn_from() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "bob".to_string(),
            amount: Uint128::new(10000),
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
        address: "bob".to_string(),
        amount: Uint128::new(10000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let handle_msg = ExecuteMsg::BurnFrom {
        owner: "bob".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    // Burn before allowance
    let handle_msg = ExecuteMsg::BurnFrom {
        owner: "bob".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Burn more than allowance
    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let handle_msg = ExecuteMsg::BurnFrom {
        owner: "bob".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Sanity check
    let handle_msg = ExecuteMsg::BurnFrom {
        owner: "bob".to_string(),
        amount: Uint128::new(2000),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());

    let bob_balance = bob.balance(deps.as_ref().storage).unwrap().u128();
    assert_eq!(bob_balance, 10000 - 2000);

    let total_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(total_supply, Uint128::new(10000 - 2000));

    // Second burn more than allowance
    let handle_msg = ExecuteMsg::BurnFrom {
        owner: "bob".to_string(),
        amount: Uint128::new(1),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_batch_burn_from() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![
            InitialBalance {
                address: "bob".to_string(),
                amount: Uint128::new(10000),
            },
            InitialBalance {
                address: "jerry".to_string(),
                amount: Uint128::new(10000),
            },
            InitialBalance {
                address: "mike".to_string(),
                amount: Uint128::new(10000),
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
        address: "bob".to_string(),
        amount: Uint128::new(10000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let actions: Vec<_> = ["bob", "jerry", "mike"]
        .iter()
        .map(|name| BurnFromAction {
            owner: name.to_string(),
            amount: Uint128::new(2500),
            memo: None,
        })
        .collect();
    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg.clone(),
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    // Burn before allowance
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));

    // Burn more than allowance
    let allowance_size = 2000;
    for name in &["bob", "jerry", "mike"] {
        let handle_msg = ExecuteMsg::IncreaseAllowance {
            spender: "alice".to_string(),
            amount: Uint128::new(allowance_size),
            padding: None,
            expiration: None,
        };
        let handle_result = execute(deps.as_mut(), mock_env(), mock_info(*name, &[]), handle_msg);
        assert!(
            handle_result.is_ok(),
            "execute() failed: {}",
            handle_result.err().unwrap()
        );
        let handle_msg = ExecuteMsg::BurnFrom {
            owner: name.to_string(),
            amount: Uint128::new(2500),
            memo: None,
            padding: None,
        };
        let handle_result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info("alice", &[]),
            handle_msg,
        );
        let error = extract_error_msg(handle_result);
        assert!(error.contains("insufficient allowance"));
    }

    // Burn some of the allowance
    let actions: Vec<_> = [("bob", 200_u128), ("jerry", 300), ("mike", 400)]
        .iter()
        .map(|(name, amount)| BurnFromAction {
            owner: name.to_string(),
            amount: Uint128::new(*amount),
            memo: None,
        })
        .collect();

    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    for (name, amount) in &[("bob", 200_u128), ("jerry", 300), ("mike", 400)] {
        let account = Account::of(deps.api.addr_canonicalize(&name).unwrap());

        let balance = account.balance(deps.as_ref().storage).unwrap().u128();
        assert_eq!(balance, 10000 - amount);
    }

    let total_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(total_supply, Uint128::new(10000 * 3 - (200 + 300 + 400)));

    // Burn the rest of the allowance
    let actions: Vec<_> = [("bob", 200_u128), ("jerry", 300), ("mike", 400)]
        .iter()
        .map(|(name, amount)| BurnFromAction {
            owner: name.to_string(),
            amount: Uint128::new(allowance_size - *amount),
            memo: None,
        })
        .collect();

    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );
    for name in &["bob", "jerry", "mike"] {
        let account = Account::of(deps.api.addr_canonicalize(&name).unwrap());

        let balance = account.balance(deps.as_ref().storage).unwrap().u128();
        assert_eq!(balance, 10000 - allowance_size);
    }
    
    let total_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(total_supply, Uint128::new(3 * (10000 - allowance_size)));

    // Second burn more than allowance
    let actions: Vec<_> = ["bob", "jerry", "mike"]
        .iter()
        .map(|name| BurnFromAction {
            owner: name.to_string(),
            amount: Uint128::new(1),
            memo: None,
        })
        .collect();
    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("insufficient allowance"));
}

#[test]
fn test_handle_decrease_allowance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::DecreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());
    let alice_canonical = deps.api.addr_canonicalize("alice").unwrap();

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice_canonical)
        .unwrap();
    assert_eq!(
        allowance,
        Allowance {
            amount: Uint128::zero(),
            expiration: None
        }
    );

    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::DecreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(50),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice_canonical)
        .unwrap();
    assert_eq!(
        allowance,
        Allowance {
            amount: Uint128::new(1950),
            expiration: None
        }
    );
}

#[test]
fn test_handle_increase_allowance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let bob = Account::of(deps.api.addr_canonicalize("bob").unwrap());
    let alice_canonical = deps.api.addr_canonicalize("alice").unwrap();

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice_canonical)
        .unwrap();

    assert_eq!(
        allowance,
        Allowance {
            amount: Uint128::new(2000),
            expiration: None
        }
    );

    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "alice".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice_canonical)
        .unwrap();
    assert_eq!(
        allowance,
        Allowance {
            amount: Uint128::new(4000),
            expiration: None
        }
    );
}

#[test]
fn test_handle_change_admin() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::ChangeAdmin {
        address: "bob".to_string(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let admin = admin::STORE.load_humanize_or_error(deps.as_ref()).unwrap();
    assert_eq!(admin, Addr::unchecked("bob"));
}

#[test]
fn test_handle_set_contract_status() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "admin".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::SetContractStatus {
        level: ContractStatusLevel::StopAll,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let contract_status = STATUS.load_or_error(deps.as_ref().storage).unwrap();
    assert!(matches!(
        contract_status,
        ContractStatusLevel::StopAll { .. }
    ));
}

#[test]
fn test_handle_redeem() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "butler".to_string(),
            amount: Uint128::new(5000),
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
            address: "butler".to_string(),
            amount: Uint128::new(5000),
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
        address: "butler".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when redeem disabled
    let handle_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(1000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("butler", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Redeem functionality is not enabled for this token."));

    // try to redeem when contract has 0 balance
    let handle_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(1000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(
        deps_no_reserve.as_mut(),
        mock_env(),
        mock_info("butler", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(
        "You are trying to redeem for more SCRT than the token has in its deposit reserve."
    ));

    let handle_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(1000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("butler", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let butler = Account::of(deps.api.addr_canonicalize("butler").unwrap());

    let balance = butler.balance(deps.as_ref().storage).unwrap().u128();
    assert_eq!(balance, 4000)
}

#[test]
fn test_handle_deposit() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "lebron".to_string(),
            amount: Uint128::new(5000),
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
        address: "lebron".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when deposit disabled
    let handle_msg = ExecuteMsg::Deposit { padding: None };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info(
            "lebron",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128::new(1000),
            }],
        ),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Deposit functionality is not enabled for this token."));

    let handle_msg = ExecuteMsg::Deposit { padding: None };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(
            "lebron",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128::new(1000),
            }],
        ),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let butler = Account::of(deps.api.addr_canonicalize("lebron").unwrap());

    let balance = butler.balance(deps.as_ref().storage).unwrap().u128();
    assert_eq!(balance, 6000)
}

#[test]
fn test_handle_burn() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "lebron".to_string(),
            amount: Uint128::new(5000),
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
        address: "lebron".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // test when burn disabled
    let handle_msg = ExecuteMsg::Burn {
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("lebron", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    let supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    let burn_amount = Uint128::new(100);
    let handle_msg = ExecuteMsg::Burn {
        amount: burn_amount,
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("lebron", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let new_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(new_supply, supply - burn_amount);
}

#[test]
fn test_handle_mint() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "lebron".to_string(),
            amount: Uint128::new(5000),
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
        address: "lebron".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try to mint when mint is disabled
    let mint_amount: u128 = 100;
    let handle_msg = ExecuteMsg::Mint {
        recipient: "lebron".to_string(),
        amount: Uint128::new(mint_amount),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    let mint_amount = Uint128::new(100);
    let handle_msg = ExecuteMsg::Mint {
        recipient: "lebron".to_string(),
        amount: mint_amount,
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let new_supply = TOTAL_SUPPLY.load_or_default(deps.as_ref().storage).unwrap();
    assert_eq!(new_supply, supply + mint_amount);
}

#[test]
fn test_handle_admin_commands() {
    let admin_err = "Unauthorized";
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "lebron".to_string(),
            amount: Uint128::new(5000),
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

    let pause_msg = ExecuteMsg::SetContractStatus {
        level: ContractStatusLevel::StopAllButRedeems,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("not_admin", &[]),
        pause_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(admin_err));

    let mint_msg = ExecuteMsg::AddMinters {
        minters: vec!["not_admin".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("not_admin", &[]),
        mint_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(admin_err));

    let mint_msg = ExecuteMsg::RemoveMinters {
        minters: vec!["admin".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("not_admin", &[]),
        mint_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(admin_err));

    let mint_msg = ExecuteMsg::SetMinters {
        minters: vec!["not_admin".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("not_admin", &[]),
        mint_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(admin_err));

    let change_admin_msg = ExecuteMsg::ChangeAdmin {
        address: "not_admin".to_string(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("not_admin", &[]),
        change_admin_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains(admin_err));
}

#[test]
fn test_handle_pause_with_withdrawals() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "lebron".to_string(),
            amount: Uint128::new(5000),
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

    let pause_msg = ExecuteMsg::SetContractStatus {
        level: ContractStatusLevel::StopAllButRedeems,
        padding: None,
    };

    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        pause_msg,
    );
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let send_msg = ExecuteMsg::Transfer {
        recipient: "account".to_string(),
        amount: Uint128::new(123),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "This contract is stopped and this action is not allowed".to_string()
    );

    let withdraw_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(5000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("lebron", &[]),
        withdraw_msg,
    );
    assert!(
        handle_result.is_ok(),
        "Withdraw failed: {}",
        handle_result.err().unwrap()
    );
}

#[test]
fn test_handle_pause_all() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "lebron".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let pause_msg = ExecuteMsg::SetContractStatus {
        level: ContractStatusLevel::StopAll,
        padding: None,
    };

    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        pause_msg,
    );
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let send_msg = ExecuteMsg::Transfer {
        recipient: "account".to_string(),
        amount: Uint128::new(123),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "This contract is stopped and this action is not allowed".to_string()
    );

    let withdraw_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(5000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("lebron", &[]),
        withdraw_msg,
    );
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
            address: "bob".to_string(),
            amount: Uint128::new(5000),
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
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = ExecuteMsg::SetMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = ExecuteMsg::SetMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Unauthorized"));

    let handle_msg = ExecuteMsg::SetMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));
}

#[test]
fn test_handle_add_minters() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "bob".to_string(),
            amount: Uint128::new(5000),
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
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = ExecuteMsg::AddMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = ExecuteMsg::AddMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Unauthorized"));

    let handle_msg = ExecuteMsg::AddMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));
}

#[test]
fn test_handle_remove_minters() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![InitialBalance {
            address: "bob".to_string(),
            amount: Uint128::new(5000),
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
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result_for_failure.is_ok(),
        "Init failed: {}",
        init_result_for_failure.err().unwrap()
    );
    // try when mint disabled
    let handle_msg = ExecuteMsg::RemoveMinters {
        minters: vec!["bob".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Mint functionality is not enabled for this token"));

    let handle_msg = ExecuteMsg::RemoveMinters {
        minters: vec!["admin".to_string()],
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Unauthorized"));

    let handle_msg = ExecuteMsg::RemoveMinters {
        minters: vec!["admin".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    // Removing another extra time to ensure nothing funky happens
    let handle_msg = ExecuteMsg::RemoveMinters {
        minters: vec!["admin".to_string()],
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));
}

// Query tests

#[test]
fn test_authenticated_queries() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "giannis".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let no_vk_yet_query_msg = QueryMsg::Balance {
        address: "giannis".to_string(),
        key: "no_vk_yet".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), no_vk_yet_query_msg);
    let error = extract_error_msg(query_result);
    assert_eq!(
        error,
        "Wrong viewing key for this address or viewing key not set".to_string()
    );

    let create_vk_msg = ExecuteMsg::CreateViewingKey {
        entropy: "34".to_string(),
        padding: None,
    };
    let handle_response = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("giannis", &[]),
        create_vk_msg,
    )
    .unwrap();
    let vk = match from_binary(&handle_response.data.unwrap()).unwrap() {
        ExecuteAnswer::CreateViewingKey { key } => key,
        _ => panic!("Unexpected result from handle"),
    };

    let query_balance_msg = QueryMsg::Balance {
        address: "giannis".to_string(),
        key: vk.0,
    };

    let query_response = query(deps.as_ref(), mock_env(), query_balance_msg).unwrap();
    let balance = match from_binary(&query_response).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected result from query"),
    };
    assert_eq!(balance, Uint128::new(5000));

    let wrong_vk_query_msg = QueryMsg::Balance {
        address: "giannis".to_string(),
        key: "wrong_vk".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), wrong_vk_query_msg);
    let error = extract_error_msg(query_result);
    assert_eq!(
        error,
        "Wrong viewing key for this address or viewing key not set".to_string()
    );
}

#[test]
fn test_query_token_info() {
    let init_name = "sec-sec".to_string();
    let init_admin = "admin".to_string();
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 8;
    let init_config: InitConfig = from_binary(&Binary::from(
        r#"{ "public_total_supply": true }"#.as_bytes(),
    ))
    .unwrap();
    let init_supply = Uint128::new(5000);

    let mut deps = mock_dependencies();
    let info = mock_info("instantiator", &[]);
    let init_msg = InstantiateMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: "giannis".to_string(),
            amount: init_supply,
        }]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None,
    };
    let init_result = instantiate(deps.as_mut(), mock_env(), info, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::TokenInfo {};
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::TokenInfo(TokenInfo {
            name,
            symbol,
            decimals,
            total_supply,
        }) => {
            assert_eq!(name, init_name);
            assert_eq!(symbol, init_symbol);
            assert_eq!(decimals, init_decimals);
            assert_eq!(total_supply, Some(Uint128::new(5000)));
        }
        _ => panic!("unexpected"),
    }
}

#[test]
fn test_query_exchange_rate() {
    // test more dec than SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = "admin".to_string();
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 8;

    let init_supply = Uint128::new(5000);

    let mut deps = mock_dependencies();
    let info = mock_info("instantiator", &[]);
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
    let init_msg = InstantiateMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: "giannis".to_string(),
            amount: init_supply,
        }]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None,
    };
    let init_result = instantiate(deps.as_mut(), mock_env(), info, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128::new(100));
            assert_eq!(denom, "SCRT");
        }
        _ => panic!("unexpected"),
    }

    // test same number of decimals as SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = "admin".to_string();
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 6;

    let init_supply = Uint128::new(5000);

    let mut deps = mock_dependencies();
    let info = mock_info("instantiator", &[]);
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
    let init_msg = InstantiateMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: "giannis".to_string(),
            amount: init_supply,
        }]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None,
    };
    let init_result = instantiate(deps.as_mut(), mock_env(), info, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128::new(1));
            assert_eq!(denom, "SCRT");
        }
        _ => panic!("unexpected"),
    }

    // test less decimal places than SCRT
    let init_name = "sec-sec".to_string();
    let init_admin = "admin".to_string();
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 3;

    let init_supply = Uint128::new(5000);

    let mut deps = mock_dependencies();
    let info = mock_info("instantiator", &[]);
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

    let init_msg = InstantiateMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: "giannis".to_string(),
            amount: init_supply,
        }]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: Some(init_config),
        callback: None,
    };

    let init_result = instantiate(deps.as_mut(), mock_env(), info, init_msg);

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128::new(1000));
            assert_eq!(denom, "SECSEC");
        }
        _ => panic!("unexpected"),
    }

    // test depost/redeem not enabled
    let init_name = "sec-sec".to_string();
    let init_admin = "admin".to_string();
    let init_symbol = "SECSEC".to_string();
    let init_decimals = 3;

    let init_supply = Uint128::new(5000);

    let mut deps = mock_dependencies();
    let info = mock_info("instantiator", &[]);
    let init_msg = InstantiateMsg {
        name: init_name.clone(),
        admin: Some(init_admin.clone()),
        symbol: init_symbol.clone(),
        decimals: init_decimals.clone(),
        initial_balances: Some(vec![InitialBalance {
            address: "giannis".to_string(),
            amount: init_supply,
        }]),
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
        config: None,
        callback: None,
    };
    let init_result = instantiate(deps.as_mut(), mock_env(), info, init_msg);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let query_msg = QueryMsg::ExchangeRate {};
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Init failed: {}",
        query_result.err().unwrap()
    );
    let query_answer: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    match query_answer {
        QueryAnswer::ExchangeRate { rate, denom } => {
            assert_eq!(rate, Uint128::new(0));
            assert_eq!(denom, String::new());
        }
        _ => panic!("unexpected"),
    }
}

#[test]
fn test_query_allowance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "giannis".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::IncreaseAllowance {
        spender: "lebron".to_string(),
        amount: Uint128::new(2000),
        padding: None,
        expiration: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("giannis", &[]),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let vk1 = ViewingKey("key1".to_string());
    let vk2 = ViewingKey("key2".to_string());

    let query_msg = QueryMsg::Allowance {
        owner: "giannis".to_string(),
        spender: "lebron".to_string(),
        key: vk1.0.clone(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    assert!(
        query_result.is_ok(),
        "Query failed: {}",
        query_result.err().unwrap()
    );
    let error = extract_error_msg(query_result);
    assert!(error.contains("Wrong viewing key"));

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: vk1.0.clone(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("lebron", &[]),
        handle_msg,
    );
    let unwrapped_result: ExecuteAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&ExecuteAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: vk2.0.clone(),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("giannis", &[]),
        handle_msg,
    );
    let unwrapped_result: ExecuteAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&ExecuteAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let query_msg = QueryMsg::Allowance {
        owner: "giannis".to_string(),
        spender: "lebron".to_string(),
        key: vk1.0.clone(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128::new(2000));

    let query_msg = QueryMsg::Allowance {
        owner: "giannis".to_string(),
        spender: "lebron".to_string(),
        key: vk2.0.clone(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128::new(2000));

    let query_msg = QueryMsg::Allowance {
        owner: "lebron".to_string(),
        spender: "giannis".to_string(),
        key: vk2.0.clone(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let allowance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Allowance { allowance, .. } => allowance,
        _ => panic!("Unexpected"),
    };
    assert_eq!(allowance, Uint128::zero());
}

#[test]
fn test_query_balance() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let unwrapped_result: ExecuteAnswer =
        from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
    assert_eq!(
        to_binary(&unwrapped_result).unwrap(),
        to_binary(&ExecuteAnswer::SetViewingKey {
            status: ResponseStatus::Success
        })
        .unwrap(),
    );

    let query_msg = QueryMsg::Balance {
        address: "bob".to_string(),
        key: "wrong_key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let error = extract_error_msg(query_result);
    assert!(error.contains("Wrong viewing key"));

    let query_msg = QueryMsg::Balance {
        address: "bob".to_string(),
        key: "key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128::new(5000));
}

#[test]
fn test_query_transfer_history() {
    let (init_result, mut deps) = init_helper(vec![InitialBalance {
        address: "bob".to_string(),
        amount: Uint128::new(5000),
    }]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "alice".to_string(),
        amount: Uint128::new(1000),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = ExecuteMsg::Transfer {
        recipient: "banana".to_string(),
        amount: Uint128::new(500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = ExecuteMsg::Transfer {
        recipient: "mango".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 0,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    // let a: QueryAnswer = from_binary(&query_result.unwrap()).unwrap();
    // println!("{:?}", a);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert!(transfers.is_empty());

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 3);

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 2,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 2);

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: Some(1),
        page_size: 2,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
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
            address: "bob".to_string(),
            amount: Uint128::new(10000),
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

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Burn {
        amount: Uint128::new(1),
        memo: Some("my burn message".to_string()),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "Pause handle failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(1000),
        denom: None,
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: Some("my mint message".to_string()),
        padding: None,
    };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Deposit { padding: None };
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(
            "bob",
            &[Coin {
                denom: "uscrt".to_string(),
                amount: Uint128::new(1000),
            }],
        ),
        handle_msg,
    );
    assert!(
        handle_result.is_ok(),
        "execute() failed: {}",
        handle_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "alice".to_string(),
        amount: Uint128::new(1000),
        memo: Some("my transfer message #1".to_string()),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "banana".to_string(),
        amount: Uint128::new(500),
        memo: Some("my transfer message #2".to_string()),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "mango".to_string(),
        amount: Uint128::new(2500),
        memo: Some("my transfer message #3".to_string()),
        padding: None,
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 3);

    let query_msg = QueryMsg::TransactionHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 10,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransactionHistory { txs, .. } => txs,
        other => panic!("Unexpected: {:?}", other),
    };

    let expected_transfers = [
        RichTx {
            id: 8,
            action: TxAction::Transfer {
                from: Addr::unchecked("bob"),
                sender: Addr::unchecked("bob"),
                recipient: Addr::unchecked("mango"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(2500),
            },
            memo: Some("my transfer message #3".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 7,
            action: TxAction::Transfer {
                from: Addr::unchecked("bob"),
                sender: Addr::unchecked("bob"),
                recipient: Addr::unchecked("banana"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(500),
            },
            memo: Some("my transfer message #2".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 6,
            action: TxAction::Transfer {
                from: Addr::unchecked("bob"),
                sender: Addr::unchecked("bob"),
                recipient: Addr::unchecked("alice"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(1000),
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
                amount: Uint128::new(1000),
            },
            memo: None,
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 4,
            action: TxAction::Mint {
                minter: Addr::unchecked("admin"),
                recipient: Addr::unchecked("bob"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(100),
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
                amount: Uint128::new(1000),
            },
            memo: None,
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 2,
            action: TxAction::Burn {
                burner: Addr::unchecked("bob"),
                owner: Addr::unchecked("bob"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(1),
            },
            memo: Some("my burn message".to_string()),
            block_time: 1571797419,
            block_height: 12345,
        },
        RichTx {
            id: 1,
            action: TxAction::Mint {
                minter: Addr::unchecked("admin"),
                recipient: Addr::unchecked("bob"),
            },
            coins: Coin {
                denom: "SECSEC".to_string(),
                amount: Uint128::new(10000),
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
        allowed_special: None,
    };

    assert_valid_symbol("TOKENA", &config).unwrap();
    assert_valid_symbol("TOK", &config).unwrap();
    assert_valid_symbol("TO", &config).unwrap_err();
    assert_valid_symbol("TOOLONG", &config).unwrap_err();
    assert_valid_symbol("TOken", &config).unwrap_err();
    assert_valid_symbol("T0K3N", &config).unwrap_err();
    assert_valid_symbol("TOK-EN", &config).unwrap_err();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: true,
        allow_numeric: false,
        allowed_special: None,
    };

    assert_valid_symbol("TOKena", &config).unwrap();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: false,
        allow_lower: true,
        allow_numeric: true,
        allowed_special: None,
    };

    assert_valid_symbol("t0k3n", &config).unwrap();
    assert_valid_symbol("T0K3N", &config).unwrap_err();

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: false,
        allow_numeric: true,
        allowed_special: Some(vec![b'-', b'@']),
    };

    assert_valid_symbol("T@K3N-", &config).unwrap();
    assert_valid_symbol("!@K3N-", &config).unwrap_err();
}

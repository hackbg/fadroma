use std::any::Any;

use crate::{
    crypto::sha_256,
    admin,
    killswitch::{self, ContractStatus},
    scrt::{
        vk::{ViewingKey, ViewingKeyHashed},
        permit::{Permit, PermitParams},
        snip20::client::{
            ExecuteAnswer, QueryAnswer, ResponseStatus,
            InitialBalance, TokenConfig, TokenInfo,
            RichTx, TxAction, BurnFromAction, QueryPermission,
            QueryWithPermit
        }
    },
    cosmwasm_std::{
        testing::{
            mock_dependencies, mock_dependencies_with_balance, mock_env, mock_info, MockApi,
            MockQuerier, MockStorage,
        },
        Addr, Api, Binary, Coin, CosmosMsg, OwnedDeps, QueryResponse,
        ReplyOn, Response, StdError, SubMsg, Uint128, WasmMsg, BankMsg,
        from_binary, to_binary, coin
    },
    core::Canonize
};

use super::{
    receiver::Snip20ReceiveMsg,
    state::*,
    SymbolValidation,
    snip20::default_impl::{
        InstantiateMsg, ExecuteMsg, QueryMsg, Error,
        instantiate, execute, query
    }
};

// Helper functions
fn init_helper(
    initial_balances: Vec<InitialBalance>,
) -> (
    Result<Response, Error>,
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
        config: Some(TokenConfig::default().enable_modify_denoms()),
        supported_denoms: None,
        callback: None,
    };

    let result = instantiate(deps.as_mut(), env, info, init_msg)
        .map_err(|x| Error::Snip20(x));

    (result, deps)
}

fn init_helper_with_config(
    initial_balances: Vec<InitialBalance>,
    enable_deposit: bool,
    enable_redeem: bool,
    enable_mint: bool,
    enable_burn: bool,
    contract_bal: u128,
) -> (
    Result<Response, Error>,
    OwnedDeps<MockStorage, MockApi, MockQuerier>,
) {
    let mut deps = mock_dependencies_with_balance(&[Coin {
        denom: "uscrt".to_string(),
        amount: Uint128::new(contract_bal),
    }]);

    let env = mock_env();
    let info = mock_info("instantiator", &[]);

    let init_config: TokenConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":false,
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{},
        \"enable_modify_denoms\": true}}",
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
        supported_denoms: Some(vec!["uscrt".into()]),
        callback: None,
    };

    let result = instantiate(deps.as_mut(), env, info, init_msg)
        .map_err(|x| Error::Snip20(x));

    (result, deps)
}

fn permit(
    signer: impl Into<String>,
    permissions: impl IntoIterator<Item = QueryPermission>
) -> Permit<QueryPermission> {
    let env = mock_env();

    Permit::new(
        signer,
        PermitParams {
            allowed_tokens: vec![env.contract.address.into_string()],
            permit_name: "snip20 permit".into(),
            chain_id: env.block.chain_id,
            permissions: permissions.into_iter().collect()
        }
    )
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

fn extract_error_msg<T: Any>(error: Result<T, Error>) -> String {
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
            Error::Base(StdError::GenericErr { msg, .. }) => msg,
            Error::VkAuth(StdError::GenericErr { msg, .. }) => msg,
            Error::Snip20(StdError::GenericErr { msg, .. }) => msg,
            Error::Admin(StdError::GenericErr { msg, .. }) => msg,
            Error::Killswitch(StdError::GenericErr { msg, .. }) => msg,
            _ => panic!("Unexpected result from init"),
        }
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
        killswitch::STORE.load_or_default(storage).unwrap(),
        ContractStatus::Operational
    );
    assert_eq!(constants.name, "sec-sec".to_string());
    assert_eq!(constants.symbol, "SECSEC".to_string());
    assert_eq!(constants.decimals, 8);
    assert_eq!(
        PRNG_SEED.load_or_error(storage).unwrap(),
        sha_256("lolz fun yay".to_owned().as_bytes())
    );
    assert_eq!(
        constants.token_settings.is_set(TokenPermission::PublicTotalSupply),
        false
    );
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
        killswitch::STORE.load_or_default(storage).unwrap(),
        ContractStatus::Operational
    );
    assert_eq!(constants.name, "sec-sec".to_string());
    assert_eq!(constants.symbol, "SECSEC".to_string());
    assert_eq!(constants.decimals, 8);
    assert_eq!(
        PRNG_SEED.load_or_error(storage).unwrap(),
        sha_256("lolz fun yay".to_owned().as_bytes())
    );
    
    assert!(!constants.token_settings.is_set(TokenPermission::PublicTotalSupply));
    assert!(constants.token_settings.is_set(TokenPermission::Deposit));
    assert!(constants.token_settings.is_set(TokenPermission::Redeem));
    assert!(constants.token_settings.is_set(TokenPermission::Mint));
    assert!(constants.token_settings.is_set(TokenPermission::Burn));
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };

    let error = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg).unwrap_err();

    assert!(matches!(error, Error::Snip20(_)));
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
        msg: Some(to_binary("hey hey you you").unwrap()),
        decoys: None,
        entropy: None,
        padding: None
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
        msg: Some(to_binary("hey hey you you").unwrap()),
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        msg: Some(to_binary("hey hey you you").unwrap()),
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
            decoys: None,
            memo: None
        })
        .collect();

    let handle_result = execute(
        deps_for_failure.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        ExecuteMsg::BatchBurnFrom {
            actions: actions.clone(),
            entropy: None,
            padding: None
        },
    );
    let error = extract_error_msg(handle_result);
    assert!(error.contains("Burn functionality is not enabled for this token."));

    // Burn before allowance
    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("alice", &[]),
        ExecuteMsg::BatchBurnFrom {
            actions,
            entropy: None,
            padding: None
        }
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
            decoys: None,
            entropy: None,
            padding: None
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
            decoys: None
        })
        .collect();

    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        entropy: None,
        padding: None
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
            decoys: None
        })
        .collect();

    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        entropy: None,
        padding: None
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
            decoys: None
        })
        .collect();
    let handle_msg = ExecuteMsg::BatchBurnFrom {
        actions,
        entropy: None,
        padding: None
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
    let alice = Account::of(deps.api.addr_canonicalize("alice").unwrap());

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice)
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
        .allowance(deps.as_ref().storage, &alice)
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
    let alice = Account::of(deps.api.addr_canonicalize("alice").unwrap());

    let allowance = bob
        .allowance(deps.as_ref().storage, &alice)
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
        .allowance(deps.as_ref().storage, &alice)
        .unwrap();

    assert_eq!(
        allowance,
        Allowance {
            amount: Uint128::new(4000),
            expiration: None
        }
    );

    let allowances = bob.allowances(deps.as_ref(), 0, 10).unwrap();
    assert_eq!(allowances.0.len(), 1);
    assert_eq!(allowances.1, 1);

    let resp = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("bob", [QueryPermission::Allowance]),
            query: QueryWithPermit::AllowancesGiven {
                owner: "bob".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap();

    match from_binary(&resp).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances: result, count } => {
            assert_eq!(owner, "bob");
            assert_eq!(result, allowances.0);
            assert_eq!(count, 1);
        }
        _ => panic!()
    }

    let allowance = &allowances.0[0];
    assert_eq!(allowance.allowance, Uint128::new(4000));
    assert_eq!(allowance.expiration, None);
    assert_eq!(allowance.spender, Addr::unchecked("alice"));

    let allowances = bob.received_allowances(deps.as_ref(), 0, 10).unwrap();
    assert!(allowances.0.is_empty());
    assert_eq!(allowances.1, 0);

    let resp = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("bob", [QueryPermission::Allowance]),
            query: QueryWithPermit::AllowancesReceived {
                spender: "bob".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap();

    match from_binary(&resp).unwrap() {
        QueryAnswer::AllowancesReceived { spender, allowances: result, count } => {
            assert_eq!(spender, "bob");
            assert_eq!(result, allowances.0);
            assert_eq!(count, 0);
        }
        _ => panic!()
    }

    let allowances = alice.allowances(deps.as_ref(), 0, 10).unwrap();
    assert!(allowances.0.is_empty());
    assert_eq!(allowances.1, 0);

    let resp = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("alice", [QueryPermission::Owner]),
            query: QueryWithPermit::AllowancesGiven {
                owner: "alice".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap();

    match from_binary(&resp).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances: result, count } => {
            assert_eq!(owner, "alice");
            assert_eq!(result, allowances.0);
            assert_eq!(count, 0);
        }
        _ => panic!()
    }

    let allowances = alice.received_allowances(deps.as_ref(), 0, 10).unwrap();
    assert_eq!(allowances.0.len(), 1);
    assert_eq!(allowances.1, 1);

    let allowance = &allowances.0[0];
    assert_eq!(allowance.allowance, Uint128::new(4000));
    assert_eq!(allowance.expiration, None);
    assert_eq!(allowance.owner, Addr::unchecked("bob"));

    let resp = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("alice", [QueryPermission::Owner]),
            query: QueryWithPermit::AllowancesReceived {
                spender: "alice".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap();

    match from_binary(&resp).unwrap() {
        QueryAnswer::AllowancesReceived { spender, allowances: result, count } => {
            assert_eq!(spender, "alice");
            assert_eq!(result, allowances.0);
            assert_eq!(count, 1);
        }
        _ => panic!()
    }
}

#[test]
fn allowances_given_and_received_parameters_match_permit() {
    let alice = "alice";

    let given_err = "Generic error: Permit signer must match the \"owner\" parameter.";
    let received_err = "Generic error: Permit signer must match the \"spender\" parameter.";

    let (init_result, deps) = init_helper(vec![]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let err = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("not_alice", [QueryPermission::Owner]),
            query: QueryWithPermit::AllowancesReceived {
                spender: alice.into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap_err();

    assert_eq!(err.to_string(), received_err);

    let err = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit(alice, [QueryPermission::Allowance]),
            query: QueryWithPermit::AllowancesReceived {
                spender: "not_alice".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap_err();

    assert_eq!(err.to_string(), received_err);

    let err = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit("not_alice", [QueryPermission::Owner]),
            query: QueryWithPermit::AllowancesGiven {
                owner: alice.into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap_err();

    assert_eq!(err.to_string(), given_err);

    let err = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::WithPermit {
            permit: permit(alice, [QueryPermission::Allowance]),
            query: QueryWithPermit::AllowancesGiven {
                owner: "not_alice".into(),
                page: None,
                page_size: 10
            }
        }
    ).unwrap_err();

    assert_eq!(err.to_string(), given_err);
}

#[test]
fn test_query_all_allowances() {
    let num_owners = 3u64;
    let num_spenders = 20u64;
    let vk = "key".to_string();
    let amount = Uint128::new(50);
    let expiration: Option<u64> = None;

    let initial_balances: Vec<InitialBalance> = (0..num_owners).into_iter().map(|i| {
        InitialBalance {
            address: format!("owner{}", i),
            amount: Uint128::new(5000)
        }
    }).collect();

    let (init_result, mut deps) = init_helper(initial_balances);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    for i in 0..num_owners {
        let handle_msg = ExecuteMsg::SetViewingKey {
            key: vk.clone(),
            padding: None,
        };

        let info = mock_info(format!("owner{}", i).as_str(), &[]);

        let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);
        let unwrapped_result: ExecuteAnswer = from_binary(
            &handle_result.unwrap().data.unwrap()
        ).unwrap();

        assert_eq!(
            to_binary(&unwrapped_result).unwrap(),
            to_binary(&ExecuteAnswer::SetViewingKey {
                status: ResponseStatus::Success
            })
            .unwrap(),
        );
    }

    for i in 0..num_owners {
        for j in 0..num_spenders {
            let handle_msg = ExecuteMsg::IncreaseAllowance {
                spender: format!("spender{}", j),
                amount,
                expiration,
                padding: None
            };
            let info = mock_info(format!("owner{}", i).as_str(), &[]);

            let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);
            assert!(
                handle_result.is_ok(),
                "handle() failed: {}",
                handle_result.err().unwrap()
            );

            let handle_msg = ExecuteMsg::SetViewingKey {
                key: vk.clone(),
                padding: None,
            };
            let info = mock_info(format!("spender{}", j).as_str(), &[]);

            let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);

            let unwrapped_result: ExecuteAnswer =
                from_binary(&handle_result.unwrap().data.unwrap()).unwrap();
                
            assert_eq!(
                to_binary(&unwrapped_result).unwrap(),
                to_binary(&ExecuteAnswer::SetViewingKey {
                    status: ResponseStatus::Success
                })
                .unwrap(),
            );
        }
    }

    for i in 0..num_owners {
        let owner_addr = Addr::unchecked(format!("owner{}", i));

        let owner = deps.api.addr_canonicalize(&owner_addr.as_ref()).unwrap();
        let owner = Account::of(owner);

        let (given, count) = owner.allowances(
            deps.as_ref(),
            0,
            num_spenders as u32
        ).unwrap();

        assert_eq!(count, num_spenders);
        assert_eq!(given.len(), num_spenders as usize);

        for (i, item) in given.into_iter().enumerate(){
            let spender = Addr::unchecked(format!("spender{}", i));

            assert_eq!(item.spender, spender);
            assert_eq!(item.allowance, amount);
            assert_eq!(item.expiration, expiration);
        }

        let (given, count) = owner.received_allowances(
            deps.as_ref(),
            0,
            (num_owners + num_spenders) as u32
        ).unwrap();

        assert_eq!(count, 0);
        assert!(given.is_empty());
    }

    for j in 0..num_spenders {
        let spender_addr = Addr::unchecked(format!("spender{}", j));

        let spender = deps.api.addr_canonicalize(spender_addr.as_str()).unwrap();
        let spender = Account::of(spender);

        let (received, count) = spender.received_allowances(
            deps.as_ref(),
            0,
            num_owners as u32
        ).unwrap();
        
        assert_eq!(count, num_owners);
        assert_eq!(received.len(), num_owners as usize);

        for (i, item) in received.into_iter().enumerate(){
            let owner = Addr::unchecked(format!("owner{}", i));

            assert_eq!(item.owner, owner);
            assert_eq!(item.allowance, amount);
            assert_eq!(item.expiration, expiration);
        }

        let (given, count) = spender.allowances(
            deps.as_ref(),
            0,
            (num_owners + num_spenders) as u32
        ).unwrap();

        assert_eq!(count, 0);
        assert!(given.is_empty());
    }

    let query_msg = QueryMsg::AllowancesGiven {
        owner: "owner0".to_string(),
        key: vk.clone(),
        page: None,
        page_size: 5,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances, count } => {
            assert_eq!(owner, "owner0".to_string());
            assert_eq!(allowances.len(), 5);
            assert_eq!(allowances[0].spender, "spender0");
            assert_eq!(allowances[0].allowance, amount);
            assert_eq!(allowances[0].expiration, expiration);
            assert_eq!(count, num_spenders);
            
            assert_eq!(allowances[1].spender, "spender1");
            assert_eq!(allowances[2].spender, "spender2");
            assert_eq!(allowances[3].spender, "spender3");
            assert_eq!(allowances[4].spender, "spender4");
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesGiven {
        owner: "owner1".to_string(),
        key: vk.clone(),
        page: Some(1),
        page_size: 5,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances, count } => {
            assert_eq!(owner, "owner1".to_string());
            assert_eq!(allowances.len(), 5);
            assert_eq!(allowances[0].spender, "spender5");
            assert_eq!(allowances[0].allowance, amount);
            assert_eq!(allowances[0].expiration, expiration);
            assert_eq!(count, num_spenders);

            assert_eq!(allowances[1].spender, "spender6");
            assert_eq!(allowances[2].spender, "spender7");
            assert_eq!(allowances[3].spender, "spender8");
            assert_eq!(allowances[4].spender, "spender9");
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesGiven {
        owner: "owner1".to_string(),
        key: vk.clone(),
        page: Some(0),
        page_size: 23,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances, count } => {
            assert_eq!(owner, "owner1".to_string());
            assert_eq!(allowances.len(), 20);
            assert_eq!(count, num_spenders);
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesGiven {
        owner: "owner1".to_string(),
        key: vk.clone(),
        page: Some(2),
        page_size: 8,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances, count } => {
            assert_eq!(owner, "owner1".to_string());
            assert_eq!(allowances.len(), 4);
            assert_eq!(count, num_spenders);
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesGiven {
        owner: "owner2".to_string(),
        key: vk.clone(),
        page: Some(5),
        page_size: 5,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesGiven { owner, allowances, count } => {
            assert_eq!(owner, "owner2".to_string());
            assert_eq!(allowances.len(), 0);
            assert_eq!(count, num_spenders);
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesReceived {
        spender: "spender0".to_string(),
        key: vk.clone(),
        page: None,
        page_size: 10,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesReceived { spender, allowances, count } => {
            assert_eq!(spender, "spender0".to_string());
            assert_eq!(allowances.len(), 3);
            assert_eq!(allowances[0].owner, "owner0");
            assert_eq!(allowances[0].allowance, amount);
            assert_eq!(allowances[0].expiration, expiration);
            assert_eq!(count, num_owners);
        },
        _ => panic!("Unexpected QueryAnswer"),
    };

    let query_msg = QueryMsg::AllowancesReceived {
        spender: "spender1".to_string(),
        key: vk.clone(),
        page: Some(1),
        page_size: 1,
    };

    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::AllowancesReceived { spender, allowances, count } => {
            assert_eq!(spender, "spender1".to_string());
            assert_eq!(allowances.len(), 1);
            assert_eq!(allowances[0].owner, "owner1");
            assert_eq!(allowances[0].allowance, amount);
            assert_eq!(allowances[0].expiration, expiration);
            assert_eq!(count, num_owners);
        },
        _ => panic!("Unexpected QueryAnswer"),
    };
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
        mode: Some(admin::Mode::Immediate {
            new_admin: "bob".to_string() 
        })
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

    let admin = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::Admin { }
    ).unwrap();
    let admin: Option<Addr> = from_binary(&admin).unwrap();

    assert_eq!(admin.unwrap(), Addr::unchecked("bob"));
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

    let status = ContractStatus::Migrating {
        reason: "stopped".into(),
        new_address: None
    };
    let handle_msg = ExecuteMsg::SetStatus {
        status: status.clone(),
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

    let stored_status = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::Status { }
    ).unwrap();
    let stored_status: ContractStatus<Addr> = from_binary(&stored_status).unwrap();

    assert_eq!(stored_status, status);
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(
        deps_no_reserve.as_mut(),
        mock_env(),
        mock_info("butler", &[]),
        handle_msg,
    );

    let error = extract_error_msg(handle_result);
    assert!(error.contains(
        "You are trying to redeem more uscrt than the token has in its reserve."
    ));

    let handle_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(1000),
        denom: None,
        decoys: None,
        entropy: None,
        padding: None
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
    let handle_msg = ExecuteMsg::Deposit {
        decoys: None,
        entropy: None,
        padding: None
    };

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

    let handle_msg = ExecuteMsg::Deposit {
        decoys: None,
        entropy: None,
        padding: None
    };

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
        decoys: None,
        entropy: None,
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
        decoys: None,
        entropy: None,
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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

    let pause_msg = ExecuteMsg::SetStatus {
        status: ContractStatus::Paused { reason: "paused".into() }
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
        mode: Some(admin::Mode::Immediate {
            new_admin: "not_admin".into()
        })
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

    let pause_msg = ExecuteMsg::SetStatus {
        status: ContractStatus::Paused { reason: "paused".into() }
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "Paused\nReason: paused".to_string()
    );

    let withdraw_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(5000),
        denom: None,
        decoys: None,
        entropy: None,
        padding: None
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

    let pause_msg = ExecuteMsg::SetStatus {
        status: ContractStatus::Migrating {
            reason: "stopped".into(),
            new_address: None
        }
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("admin", &[]), send_msg);
    let error = extract_error_msg(handle_result);
    assert_eq!(
        error,
        "Migrating\nReason: stopped".to_string()
    );

    let withdraw_msg = ExecuteMsg::Redeem {
        amount: Uint128::new(5000),
        denom: None,
        decoys: None,
        entropy: None,
        padding: None
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
        "Migrating\nReason: stopped".to_string()
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };

    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };
    
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let error = extract_error_msg(handle_result);
    assert!(error.contains("allowed to minter accounts only"));

    let handle_msg = ExecuteMsg::Mint {
        recipient: "bob".to_string(),
        amount: Uint128::new(100),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
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
    let init_config = TokenConfig::default().public_total_supply();
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
        supported_denoms: None,
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
    let init_config: TokenConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{},
        \"enable_modify_denoms\": true}}",
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
        supported_denoms: None,
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
    let init_config: TokenConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{},
        \"enable_modify_denoms\": true}}",
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
        supported_denoms: None,
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
    let init_config: TokenConfig = from_binary(&Binary::from(
        format!(
            "{{\"public_total_supply\":{},
        \"enable_deposit\":{},
        \"enable_redeem\":{},
        \"enable_mint\":{},
        \"enable_burn\":{},
        \"enable_modify_denoms\": true}}",
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
        supported_denoms: None,
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
        supported_denoms: None,
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
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = ExecuteMsg::Transfer {
        recipient: "banana".to_string(),
        amount: Uint128::new(500),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = ExecuteMsg::Transfer {
        recipient: "mango".to_string(),
        amount: Uint128::new(2500),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None
    };
    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 0,
        should_filter_decoys: true
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
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
        should_filter_decoys: true
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
        should_filter_decoys: true
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
        should_filter_decoys: true
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
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
        decoys: None,
        entropy: None,
        padding: None
    };

    let handle_result = execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        handle_msg,
    );
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::Deposit {
        decoys: None,
        entropy: None,
        padding: None
    };

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
        decoys: None,
        entropy: None,
        padding: None
    };

    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "banana".to_string(),
        amount: Uint128::new(500),
        memo: Some("my transfer message #2".to_string()),
        decoys: None,
        entropy: None,
        padding: None
    };

    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "mango".to_string(),
        amount: Uint128::new(2500),
        memo: Some("my transfer message #3".to_string()),
        decoys: None,
        entropy: None,
        padding: None
    };

    let handle_result = execute(deps.as_mut(), mock_env(), mock_info("bob", &[]), handle_msg);
    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: false
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
        should_filter_decoys: false
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
                denom: "uscrt".to_string(),
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

    assert!(config.is_valid("TOKENA"));
    assert!(config.is_valid("TOK"));
    assert!(!config.is_valid("TO"));

    assert!(!config.is_valid("TOOLONG"));
    assert!(!config.is_valid("TOken"));
    assert!(!config.is_valid("T0K3N"));
    assert!(!config.is_valid("TOK-EN"));

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: true,
        allow_numeric: false,
        allowed_special: None,
    };

    assert!(config.is_valid("TOKena"));

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: false,
        allow_lower: true,
        allow_numeric: true,
        allowed_special: None,
    };

    assert!(config.is_valid("t0k3n"));
    assert!(!config.is_valid("T0K3N"));

    let config = SymbolValidation {
        length: 3..=6,
        allow_upper: true,
        allow_lower: false,
        allow_numeric: true,
        allowed_special: Some(vec![b'-', b'@']),
    };

    assert!(config.is_valid("T@K3N-"));
    assert!(!config.is_valid("!@K3N-"));
}

#[test]
fn decoys_balance_is_unaffected() {
    let barry = "barry";
    let sally = "sally";
    let jon = "jon";
    let casey = "casey";

    let jon_balance = Uint128::new(1234);

    let barry_balance = Uint128::new(2000);
    let transfer_amount = Uint128::new(1000);

    let (init_result, mut deps) = init_helper(vec![
        InitialBalance {
            address: barry.into(),
            amount: barry_balance
        },
        InitialBalance {
            address: jon.into(),
            amount: jon_balance
        }
    ]);

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let msg = ExecuteMsg::Transfer {
        recipient: sally.into(),
        amount: transfer_amount,
        memo: None,
        decoys: Some(vec![jon.into(), casey.into()]),
        entropy: Some(Binary::from(b"nakamarra")),
        padding: None
    };

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(barry, &[]),
        msg
    ).unwrap();

    let barry = Account::of(barry.canonize(&deps.api).unwrap());
    let sally = Account::of(sally.canonize(&deps.api).unwrap());
    let jon = Account::of(jon.canonize(&deps.api).unwrap());
    let casey = Account::of(casey.canonize(&deps.api).unwrap());

    let stored_balance = barry.balance(&deps.storage).unwrap();
    assert_eq!(stored_balance, barry_balance - transfer_amount);

    let stored_balance = sally.balance(&deps.storage).unwrap();
    assert_eq!(stored_balance, transfer_amount);

    let stored_balance = jon.balance(&deps.storage).unwrap();
    assert_eq!(stored_balance, jon_balance);

    let stored_balance = casey.balance(&deps.storage).unwrap();
    assert_eq!(stored_balance, Uint128::zero());
}

#[test]
fn test_query_transfer_history_with_decoys() {
    let (init_result, mut deps) = init_helper(vec![
        InitialBalance {
            address: "bob".to_string(),
            amount: Uint128::new(5000),
        },
        InitialBalance {
            address: "jhon".to_string(),
            amount: Uint128::new(7000),
        },
    ]);
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "key".to_string(),
        padding: None,
    };
    let info = mock_info("bob", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "alice_key".to_string(),
        padding: None,
    };
    let info = mock_info("alice", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "lior_key".to_string(),
        padding: None,
    };
    let info = mock_info("lior", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);
    assert!(ensure_success(handle_result.unwrap()));

    let handle_msg = ExecuteMsg::SetViewingKey {
        key: "banana_key".to_string(),
        padding: None,
    };
    let info = mock_info("banana", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);

    assert!(ensure_success(handle_result.unwrap()));

    let lior_addr = Addr::unchecked("lior".to_string());
    let jhon_addr = Addr::unchecked("jhon".to_string());
    let alice_addr = Addr::unchecked("alice".to_string());

    let handle_msg = ExecuteMsg::Transfer {
        recipient: "alice".to_string(),
        amount: Uint128::new(1000),
        memo: None,
        decoys: Some(vec![
            lior_addr.clone().into(),
            jhon_addr.clone().into(),
            alice_addr.clone().into()
        ]),

        entropy: Some(Binary::from_base64("VEVTVFRFU1RURVNUQ0hFQ0tDSEVDSw==").unwrap()),
        padding: None,
    };
    let info = mock_info("bob", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);

    let result = handle_result.unwrap();
    assert!(ensure_success(result));
    let handle_msg = ExecuteMsg::Transfer {
        recipient: "banana".to_string(),
        amount: Uint128::new(500),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None,
    };
    let info = mock_info("bob", &[]);

    let handle_result = execute(deps.as_mut(), mock_env(), info, handle_msg);

    let result = handle_result.unwrap();
    assert!(ensure_success(result));

    let query_msg = QueryMsg::TransferHistory {
        address: "bob".to_string(),
        key: "key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: true,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 2);

    let query_msg = QueryMsg::TransferHistory {
        address: "alice".to_string(),
        key: "alice_key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: false,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 2);

    let query_msg = QueryMsg::TransferHistory {
        address: "alice".to_string(),
        key: "alice_key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: true,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 1);

    let query_msg = QueryMsg::TransferHistory {
        address: "banana".to_string(),
        key: "banana_key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: true,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 1);

    let query_msg = QueryMsg::TransferHistory {
        address: "lior".to_string(),
        key: "lior_key".to_string(),
        page: None,
        page_size: 10,
        should_filter_decoys: true,
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let transfers = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::TransferHistory { txs, .. } => txs,
        _ => panic!("Unexpected"),
    };
    assert_eq!(transfers.len(), 0);

    let query_msg = QueryMsg::Balance {
        address: "bob".to_string(),
        key: "key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128::new(3500));

    let query_msg = QueryMsg::Balance {
        address: "alice".to_string(),
        key: "alice_key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128::new(1000));

    let query_msg = QueryMsg::Balance {
        address: "banana".to_string(),
        key: "banana_key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128::new(500));

    let query_msg = QueryMsg::Balance {
        address: "lior".to_string(),
        key: "lior_key".to_string(),
    };
    let query_result = query(deps.as_ref(), mock_env(), query_msg);
    let balance = match from_binary(&query_result.unwrap()).unwrap() {
        QueryAnswer::Balance { amount } => amount,
        _ => panic!("Unexpected"),
    };
    assert_eq!(balance, Uint128::new(0));
}

#[test]
fn adding_sender_as_decoy_does_not_increase_balance_twice() {
    let barry = "barry";
    let sally = "sally";
    let casey = "casey";

    let transfer_amount = Uint128::new(1000);

    let (init_result, mut deps) = init_helper(vec![
        InitialBalance {
            address: barry.into(),
            amount: transfer_amount
        }
    ]);

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let msg = ExecuteMsg::Transfer {
        recipient: sally.into(),
        amount: transfer_amount,
        memo: None,
        decoys: Some(vec![casey.into(), sally.into()]),
        entropy: Some(Binary::from(b"nakamarra")),
        padding: None
    };

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(barry, &[]),
        msg
    ).unwrap();

    let sally = Account::of(sally.canonize(&deps.api).unwrap());

    let stored_balance = sally.balance(&deps.storage).unwrap();
    assert_eq!(stored_balance, transfer_amount);
}

#[test]
fn history_with_decoys() {
    let barry = "barry";
    let sally = "sally";
    let jon = "jon";
    let casey = "casey";

    let transfer_amount = Uint128::new(1000);

    let (init_result, mut deps) = init_helper(vec![
        InitialBalance {
            address: barry.into(),
            amount: transfer_amount
        },
        InitialBalance {
            address: sally.into(),
            amount: transfer_amount
        }
    ]);

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let msg = ExecuteMsg::Transfer {
        recipient: jon.into(),
        amount: transfer_amount,
        memo: None,
        decoys: Some(vec![sally.into(), casey.into()]),
        entropy: Some(Binary::from(b"nakamarra")),
        padding: None
    };

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(barry, &[]),
        msg
    ).unwrap();

    let msg = ExecuteMsg::Transfer {
        recipient: sally.into(),
        amount: transfer_amount,
        memo: None,
        decoys: Some(vec![barry.into(), casey.into()]),
        entropy: Some(Binary::from(b"nakamarra")),
        padding: None
    };

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(jon, &[]),
        msg
    ).unwrap();

    let query_history = |acc: &str| {
        let acc = acc.canonize(&deps.api).unwrap();
        let acc = Account::of(acc);

        let txs = acc.txs(deps.as_ref(), 0, 10, false).unwrap();
        let txs_filtered = acc.txs(deps.as_ref(), 0, 10, true).unwrap();

        let transfers = acc.transfers(deps.as_ref(), 0, 10, false).unwrap();
        let transfers_filtered = acc.transfers(deps.as_ref(), 0, 10, true).unwrap();

        (txs.0, txs_filtered.0, transfers.0, transfers_filtered.0)
    };

    let (txs, txs_filtered, transfers, transfers_filtered) = query_history(barry);
    assert_eq!(txs.len(), 3);
    assert_eq!(txs_filtered.len(), 2);

    assert_eq!(txs[0].action, TxAction::Decoy { address: Addr::unchecked(barry) });
    assert_eq!(
        txs[1].action,
        TxAction::Transfer {
            from: Addr::unchecked(barry),
            sender: Addr::unchecked(barry),
            recipient: Addr::unchecked(jon)
        }
    );
    assert_eq!(
        txs[2].action,
        TxAction::Mint {
            minter: Addr::unchecked("admin"),
            recipient: Addr::unchecked(barry)
        }
    );

    assert_eq!(txs[1], txs_filtered[0]);
    assert_eq!(txs[2], txs_filtered[1]);

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers_filtered.len(), 1);

    assert_eq!(transfers[0].from, Addr::unchecked(jon));
    assert_eq!(transfers[0].sender, Addr::unchecked(jon));
    assert_eq!(transfers[0].receiver, Addr::unchecked(barry));
    assert_eq!(transfers[0].block_height, Some(0));

    assert_eq!(transfers[1].from, Addr::unchecked(barry));
    assert_eq!(transfers[1].sender, Addr::unchecked(barry));
    assert_eq!(transfers[1].receiver, Addr::unchecked(jon));
    assert_ne!(transfers[1].block_height, Some(0));

    assert_eq!(transfers[1], transfers_filtered[0]);


    let (txs, txs_filtered, transfers, transfers_filtered) = query_history(sally);
    assert_eq!(txs.len(), 3);
    assert_eq!(txs_filtered.len(), 2);

    assert_eq!(
        txs[0].action,
        TxAction::Transfer {
            from: Addr::unchecked(jon),
            sender: Addr::unchecked(jon),
            recipient: Addr::unchecked(sally)
        }
    );
    assert_eq!(txs[1].action, TxAction::Decoy { address: Addr::unchecked(sally) });
    assert_eq!(
        txs[2].action,
        TxAction::Mint {
            minter: Addr::unchecked("admin"),
            recipient: Addr::unchecked(sally)
        }
    );

    assert_eq!(txs[0], txs_filtered[0]);
    assert_eq!(txs[2], txs_filtered[1]);

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers_filtered.len(), 1);

    assert_eq!(transfers[0].from, Addr::unchecked(jon));
    assert_eq!(transfers[0].sender, Addr::unchecked(jon));
    assert_eq!(transfers[0].receiver, Addr::unchecked(sally));
    assert_ne!(transfers[0].block_height, Some(0));

    assert_eq!(transfers[1].from, Addr::unchecked(barry));
    assert_eq!(transfers[1].sender, Addr::unchecked(barry));
    assert_eq!(transfers[1].receiver, Addr::unchecked(sally));
    assert_eq!(transfers[1].block_height, Some(0));

    assert_eq!(transfers[0], transfers_filtered[0]);


    let (txs, txs_filtered, transfers, transfers_filtered) = query_history(jon);
    assert_eq!(txs.len(), 2);
    assert_eq!(txs_filtered.len(), 2);

    assert_eq!(
        txs[0].action,
        TxAction::Transfer {
            from: Addr::unchecked(jon),
            sender: Addr::unchecked(jon),
            recipient: Addr::unchecked(sally)
        }
    );
    assert_eq!(
        txs[1].action,
        TxAction::Transfer {
            from: Addr::unchecked(barry),
            sender: Addr::unchecked(barry),
            recipient: Addr::unchecked(jon)
        }
    );

    assert_eq!(txs[0], txs_filtered[0]);
    assert_eq!(txs[1], txs_filtered[1]);

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers_filtered.len(), 2);

    assert_eq!(transfers[0].from, Addr::unchecked(jon));
    assert_eq!(transfers[0].sender, Addr::unchecked(jon));
    assert_eq!(transfers[0].receiver, Addr::unchecked(sally));
    assert_ne!(transfers[0].block_height, Some(0));

    assert_eq!(transfers[1].from, Addr::unchecked(barry));
    assert_eq!(transfers[1].sender, Addr::unchecked(barry));
    assert_eq!(transfers[1].receiver, Addr::unchecked(jon));
    assert_ne!(transfers[1].block_height, Some(0));

    assert_eq!(transfers[0], transfers_filtered[0]);
    assert_eq!(transfers[1], transfers_filtered[1]);


    let (txs, txs_filtered, transfers, transfers_filtered) = query_history(casey);
    assert_eq!(txs.len(), 2);
    assert_eq!(txs_filtered.len(), 0);

    assert_eq!(txs[0].action, TxAction::Decoy { address: Addr::unchecked(casey) });
    assert_eq!(txs[1].action, TxAction::Decoy { address: Addr::unchecked(casey) });

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers_filtered.len(), 0);

    assert_eq!(transfers[0].from, Addr::unchecked(jon));
    assert_eq!(transfers[0].sender, Addr::unchecked(jon));
    assert_eq!(transfers[0].receiver, Addr::unchecked(casey));
    assert_eq!(transfers[0].block_height, Some(0));

    assert_eq!(transfers[1].from, Addr::unchecked(barry));
    assert_eq!(transfers[1].sender, Addr::unchecked(barry));
    assert_eq!(transfers[1].receiver, Addr::unchecked(casey));
    assert_eq!(transfers[1].block_height, Some(0));
}

#[test]
fn multi_denom_deposit_redeem() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![],
        true, true, false, false, 0
    );
    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let uscrt = "uscrt";
    let ucosm = "ucosm";
    let sender = "sender";

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        ExecuteMsg::AddSupportedDenoms {
            denoms: vec![uscrt.into(), ucosm.into()]
        }
    ).unwrap();

    let amount = 100;

    let deposited = vec![
        coin(amount, uscrt),
        coin(amount, ucosm),
        // This should be skipped and not added to history
        coin(0, ucosm),
    ];

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &deposited),
        ExecuteMsg::Deposit { decoys: None, entropy: None, padding: None }
    ).unwrap();

    deps.querier.update_balance(mock_env().contract.address, deposited);

    let account = Account::of(sender.canonize(&deps.api).unwrap());

    let txs = account.txs(deps.as_ref(), 0, 10, true).unwrap().0;
    assert_eq!(txs.len(), 2);
    assert_eq!(txs[0].coins, coin(amount, ucosm));
    assert_eq!(txs[1].coins, coin(amount, uscrt));

    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(
            sender,
            &[
                coin(amount, uscrt),
                coin(amount, "unsupported")
            ]
        ),
        ExecuteMsg::Deposit { decoys: None, entropy: None, padding: None }
    ).unwrap_err();

    assert_eq!(
        err.to_string(),
        "Generic error: Tried to deposit an unsupported token: unsupported."
    );

    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &[]),
        ExecuteMsg::Redeem {
            amount: amount.into(),
            denom: None,
            entropy: None,
            decoys: None,
            padding: None
        }
    ).unwrap_err();

    assert_eq!(
        err.to_string(),
        "Generic error: Tried to redeem without specifying denom, but multiple coins are supported."
    );

    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &[]),
        ExecuteMsg::Redeem {
            amount: amount.into(),
            denom: Some("unsupported".into()),
            entropy: None,
            decoys: None,
            padding: None
        }
    ).unwrap_err();

    assert_eq!(
        err.to_string(),
        "Generic error: Tried to redeem an unsupported coin."
    );

    let err = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &[]),
        ExecuteMsg::Redeem {
            amount: Uint128::zero(),
            denom: Some(uscrt.into()),
            entropy: None,
            decoys: None,
            padding: None
        }
    ).unwrap_err();

    assert_eq!(
        err.to_string(),
        "Generic error: Redeem amount cannot be 0."
    );

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        ExecuteMsg::RemoveSupportedDenoms {
            denoms: vec![uscrt.into()]
        }
    ).unwrap();

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &[]),
        ExecuteMsg::Redeem {
            amount: (amount / 2).into(),
            denom: None,
            entropy: None,
            decoys: None,
            padding: None
        }
    ).unwrap();

    let mut resp = execute(
        deps.as_mut(),
        mock_env(),
        mock_info(sender, &[]),
        ExecuteMsg::Redeem {
            amount: (amount / 2).into(),
            denom: Some(ucosm.into()),
            entropy: None,
            decoys: None,
            padding: None
        }
    ).unwrap();

    assert_eq!(resp.messages.len(), 1);

    let msg = resp.messages.pop().unwrap();
    let expected_amount = amount / 2;

    let CosmosMsg::Bank(
        BankMsg::Send { to_address, amount: sent_coins }
    ) = msg.msg else{
        panic!("Expecting a BankMsg.");
    };

    assert_eq!(to_address, sender);
    assert_eq!(sent_coins, vec![coin(expected_amount, ucosm)]);

    let txs = account.txs(deps.as_ref(), 0, 10, true).unwrap().0;
    // Should be 4 instead of 5, but there is no storage revert.
    assert_eq!(txs.len(), 5);
    assert_eq!(txs[0].coins, coin(amount / 2, ucosm));
    assert_eq!(txs[1].coins, coin(amount / 2, ucosm));
}

#[test]
fn token_config() {
    let (init_result, mut deps) = init_helper_with_config(
        vec![],
        false, true, false, true, 0
    );

    assert!(
        init_result.is_ok(),
        "Init failed: {}",
        init_result.err().unwrap()
    );

    let uscrt = "uscrt";
    let ucosm = "ucosm";

    execute(
        deps.as_mut(),
        mock_env(),
        mock_info("admin", &[]),
        ExecuteMsg::AddSupportedDenoms {
            denoms: vec![uscrt.into(), ucosm.into()]
        }
    ).unwrap();

    let result = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::TokenConfig { }
    ).unwrap();

    let result: QueryAnswer = from_binary(&result).unwrap();

    let QueryAnswer::TokenConfig {
        public_total_supply,
        deposit_enabled,
        redeem_enabled,
        mint_enabled,
        burn_enabled,
        supported_denoms
    } = result else {
        panic!("Expecting QueryAnswer::TokenConfig");
    };

    assert!(!public_total_supply);
    assert!(!deposit_enabled);
    assert!(redeem_enabled);
    assert!(!mint_enabled);
    assert!(burn_enabled);
    assert_eq!(
        supported_denoms,
        [uscrt.to_string(), ucosm.to_string()]
    );
}

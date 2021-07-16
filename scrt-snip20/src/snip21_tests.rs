use fadroma::scrt::cosmwasm_std::{
    from_binary, to_binary, Coin, CosmosMsg,
    Uint128, WasmMsg, HumanAddr, testing::*
};

use crate::{
    receiver::Snip20ReceiveMsg,
    msg::*
};
use crate::tests_shared::*;

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

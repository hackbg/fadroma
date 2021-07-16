use fadroma::scrt::cosmwasm_std::{
    Api, Uint128, HumanAddr, testing::*
};

use crate::{
    state::ReadonlyConfig,
    msg::*,
    batch,
    tests_shared::*
};

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
use crate::{ContractEnsemble, EnsembleError};
use fadroma::prelude::*;

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
    ensemble.ctx.state.push_scope();
    ensemble
        .ctx
        .state
        .bank
        .remove_funds(&addr1, Coin::new(1000u128, "uscrt"))
        .unwrap();

    match ensemble.ctx.delegations.delegate(
        addr1.to_string(),
        val_addr_1.to_string(),
        Coin::new(1000u128, "uscrt"),
    ) {
        Ok(result) => Ok(result),
        Err(result) => {
            ensemble.ctx.state.revert_scope();
            Err(result)
        }
    }
    .unwrap();
    ensemble.ctx.state.commit();

    ensemble.ctx.state.push_scope();
    ensemble
        .ctx
        .state
        .bank
        .remove_funds(&addr1, Coin::new(314159u128, "notscrt"))
        .unwrap();

    match ensemble.ctx.delegations.delegate(
        addr1.to_string(),
        val_addr_1.to_string(),
        Coin::new(314159u128, "notscrt"),
    ) {
        Err(error) => {
            ensemble.ctx.state.revert_scope();

            match error {
                EnsembleError::Staking(msg) => assert_eq!("Incorrect coin denom", msg),
                _ => panic!("Wrong denom error improperly caught"),
            };
        }
        _ => panic!("Wrong denom error improperly caught"),
    };
    ensemble.ctx.state.commit();

    ensemble.ctx.state.push_scope();
    ensemble
        .ctx
        .state
        .bank
        .remove_funds(&addr1, Coin::new(100u128, "uscrt"))
        .unwrap();
        
    match ensemble
        .ctx
        .delegations
        .delegate(addr1.to_string(), val_addr_3.into(), Coin::new(100u128, "uscrt"))
    {
        Err(error) => {
            ensemble.ctx.state.revert_scope();
            match error {
                EnsembleError::Staking(msg) => assert_eq!("Validator not found", msg),
                _ => panic!("Invalid validator error improperly caught"),
            };
        }
        _ => panic!("Invalid validator error improperly caught"),
    };
    ensemble.ctx.state.commit();

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
            EnsembleError::Staking(msg) => assert_eq!("Delegation not found", msg),
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
            EnsembleError::Staking(msg) => assert_eq!("Insufficient funds", msg),
            _ => panic!("Undelegate too much error improperly caught"),
        },
        _ => panic!("Undelegate too much error improperly caught"),
    };

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
        .state
        .bank
        .remove_funds(&addr1, Coin::new(100u128, "uscrt"))
        .unwrap_err();

    ensemble
        .ctx
        .delegations
        .delegate(
            addr1.to_string(),
            val_addr_2.to_string(),
            Coin::new(100u128, "uscrt"),
        )
        .unwrap();

    ensemble.ctx.state.commit();

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

    ensemble.add_funds(&addr1, withdraw_amount);

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
            .state
            .bank
            .query_balances(&addr1, Some("uscrt".to_string())),
        vec![Coin::new(50u128, "uscrt")],
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
            .state
            .bank
            .query_balances(&addr1, Some("uscrt".to_string())),
        vec![Coin::new(875u128, "uscrt")], // 500 undelegate, 325 undelegate, 50 rewards
    );
}

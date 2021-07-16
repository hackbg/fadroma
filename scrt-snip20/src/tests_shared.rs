use fadroma::scrt::{
    cosmwasm_std::{
        from_binary, Binary, Coin, Env, Extern, StdError, StdResult, Uint128,
        QueryResponse, HandleResponse, HumanAddr, InitResponse, Storage, Api, Querier,
        testing::*
    },
    utils::viewing_key::ViewingKey,
};
use std::any::Any;
use crate::{
    snip20_handle, snip20_init, snip20_query, DefaultSnip20Impl,
    msg::*
};

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    snip20_init(deps, env, msg, DefaultSnip20Impl)
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> StdResult<HandleResponse> {
    snip20_handle(deps, env, msg, DefaultSnip20Impl)
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    snip20_query(deps, msg, DefaultSnip20Impl)
}

pub fn init_helper(
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

pub fn init_helper_with_config(
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
pub fn _auth_query_helper(
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

pub fn extract_error_msg<T: Any>(error: StdResult<T>) -> String {
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

pub fn ensure_success(handle_result: HandleResponse) -> bool {
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

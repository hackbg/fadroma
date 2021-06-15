use std::ops::RangeInclusive;

use cosmwasm_std::{
    log, to_binary, Api, BankMsg, Binary, CanonicalAddr, Coin, CosmosMsg,
    Env, Extern, HandleResponse, HumanAddr, InitResponse, Querier,
    ReadonlyStorage, StdError, StdResult, Storage, Uint128, WasmMsg
};

use cosmwasm_utils::viewing_key::{ViewingKey, VIEWING_KEY_SIZE};
use cosmwasm_utils::crypto::sha_256;

use crate::msg::{
    ContractStatusLevel, HandleAnswer, HandleMsg, InitMsg,
    QueryAnswer, ResponseStatus, QueryMsg
};
use crate::receiver::Snip20ReceiveMsg;
use crate::state::{
    get_receiver_hash, read_allowance, set_receiver_hash, write_allowance,
    read_viewing_key, write_viewing_key, Balances, Config, Constants,
    ReadonlyBalances, ReadonlyConfig
};
use crate::transaction_history::{
    get_transfers, get_txs, store_burn, store_deposit, store_mint,
    store_redeem, store_transfer,
};
use crate::batch;
use crate::utils::pad_response;

pub fn snip20_init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
    snip20: impl Snip20
) -> StdResult<InitResponse> {
    // Check name, symbol, decimals
    assert_valid_name(&msg.name, snip20.name_range())?;
    assert_valid_symbol(&msg.symbol, snip20.symbol_range())?;

    if msg.decimals > 18 {
        return Err(StdError::generic_err("Decimals must not exceed 18"));
    }

    let init_config = msg.config.unwrap_or_default();
    
    let admin = msg.admin.unwrap_or(env.message.sender);
    let canon_admin = deps.api.canonical_address(&admin)?;

    let mut total_supply: u128 = 0;
    {
        let initial_balances = msg.initial_balances.unwrap_or_default();

        for balance in initial_balances {
            let balance_address = deps.api.canonical_address(&balance.address)?;
            let amount = balance.amount.u128();

            let mut balances = Balances::from_storage(&mut deps.storage);
            balances.set_account_balance(&balance_address, amount);

            if let Some(new_total_supply) = total_supply.checked_add(amount) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(
                    "The sum of all initial balances exceeds the maximum possible total supply",
                ));
            }

            store_mint(
                &mut deps.storage,
                &canon_admin,
                &balance_address,
                balance.amount,
                msg.symbol.clone(),
                Some("Initial Balance".to_string()),
                &env.block,
            )?;
        }
    }

    let prng_seed_hashed = sha_256(&msg.prng_seed.0);

    let mut config = Config::from_storage(&mut deps.storage);
    config.set_constants(&Constants {
        name: msg.name,
        symbol: msg.symbol,
        decimals: msg.decimals,
        admin: admin.clone(),
        prng_seed: prng_seed_hashed.to_vec(),
        total_supply_is_public: init_config.public_total_supply(),
        deposit_is_enabled: init_config.deposit_enabled(),
        redeem_is_enabled: init_config.redeem_enabled(),
        mint_is_enabled: init_config.mint_enabled(),
        burn_is_enabled: init_config.burn_enabled(),
    })?;
    config.set_total_supply(total_supply);
    config.set_contract_status(ContractStatusLevel::NormalRun);

    let minters = if init_config.mint_enabled() {
        Vec::from([admin])
    } else {
        Vec::new()
    };

    config.set_minters(minters)?;

    let mut messages = vec![];

    if let Some(callback) = msg.callback {
        messages.push(
            CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: callback.contract.address,
                callback_code_hash: callback.contract.code_hash,
                msg: callback.msg,
                send: vec![],
            })
        )
    }
    
    Ok(InitResponse {
        messages,
        log: vec![
            log("token_address", env.contract.address),
            log("token_code_hash", env.contract_code_hash)
        ]
    })
}

pub fn snip20_handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
    snip20: impl Snip20
) -> StdResult<HandleResponse> {
    let contract_status = ReadonlyConfig::from_storage(&deps.storage).contract_status();

    match contract_status {
        ContractStatusLevel::StopAll | ContractStatusLevel::StopAllButRedeems => {
            let response = match msg {
                HandleMsg::SetContractStatus { level, .. } => snip20.set_contract_status(deps, env, level),
                HandleMsg::Redeem { amount, .. }
                    if contract_status == ContractStatusLevel::StopAllButRedeems =>
                {
                    snip20.redeem(deps, env, amount)
                }
                _ => Err(StdError::generic_err(
                    "This contract is stopped and this action is not allowed",
                )),
            };
            return pad_response(response);
        }
        ContractStatusLevel::NormalRun => {} // If it's a normal run just continue
    }

    let response = match msg {
        // Native
        HandleMsg::Deposit { .. } => snip20.deposit(deps, env),
        HandleMsg::Redeem { amount, .. } => snip20.redeem(deps, env, amount),

        // Base
        HandleMsg::Transfer {
            recipient,
            amount,
            memo,
            ..
        } => snip20.transfer(deps, env, recipient, amount, memo),
        HandleMsg::Send {
            recipient,
            amount,
            msg,
            memo,
            ..
        } => snip20.send(deps, env, recipient, amount, memo, msg),
        HandleMsg::Burn { amount, memo, .. } => snip20.burn(deps, env, amount, memo),
        HandleMsg::RegisterReceive { code_hash, .. } => snip20.register_receive(deps, env, code_hash),
        HandleMsg::CreateViewingKey { entropy, .. } => snip20.create_viewing_key(deps, env, entropy),
        HandleMsg::SetViewingKey { key, .. } => snip20.set_viewing_key(deps, env, key),

        // Allowance
        HandleMsg::IncreaseAllowance {
            spender,
            amount,
            expiration,
            ..
        } => snip20.increase_allowance(deps, env, spender, amount, expiration),
        HandleMsg::DecreaseAllowance {
            spender,
            amount,
            expiration,
            ..
        } => snip20.decrease_allowance(deps, env, spender, amount, expiration),
        HandleMsg::TransferFrom {
            owner,
            recipient,
            amount,
            memo,
            ..
        } => snip20.transfer_from(deps, env, owner, recipient, amount, memo),
        HandleMsg::SendFrom {
            owner,
            recipient,
            amount,
            msg,
            memo,
            ..
        } => snip20.send_from(deps, env, owner, recipient, amount, memo, msg),
        HandleMsg::BurnFrom {
            owner,
            amount,
            memo,
            ..
        } => snip20.burn_from(deps, env, owner, amount, memo),

        // Mint
        HandleMsg::Mint {
            recipient,
            amount,
            memo,
            ..
        } => snip20.mint(deps, env, recipient, amount, memo),

        // Other
        HandleMsg::ChangeAdmin { address, .. } => snip20.change_admin(deps, env, address),
        HandleMsg::SetContractStatus { level, .. } => snip20.set_contract_status(deps, env, level),
        HandleMsg::AddMinters { minters, .. } => snip20.add_minters(deps, env, minters),
        HandleMsg::RemoveMinters { minters, .. } => snip20.remove_minters(deps, env, minters),
        HandleMsg::SetMinters { minters, .. } => snip20.set_minters(deps, env, minters),

        // SNIP22
        HandleMsg::BatchTransfer { actions, .. } => snip20.batch_transfer(deps, env, actions),
        HandleMsg::BatchSend { actions, .. } => snip20.batch_send(deps, env, actions),
        HandleMsg::BatchTransferFrom { actions, .. } => {
            snip20.batch_transfer_from(deps, env, actions)
        }
        HandleMsg::BatchSendFrom { actions, .. } => snip20.batch_send_from(deps, env, actions),
        HandleMsg::BatchBurnFrom { actions, .. } => snip20.batch_burn_from(deps, env, actions),
        HandleMsg::BatchMint { actions, .. } => snip20.batch_mint(deps, env, actions)
    };

    pad_response(response)
}

pub fn snip20_query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>, msg: QueryMsg,
    snip20: impl Snip20
) -> StdResult<Binary> {
    match msg {
        QueryMsg::TokenInfo {} => snip20.query_token_info(&deps.storage),
        QueryMsg::ContractStatus {} => snip20.query_contract_status(&deps.storage),
        QueryMsg::ExchangeRate {} => snip20.query_exchange_rate(&deps.storage),
        QueryMsg::Minters { .. } => snip20.query_minters(deps),
        _ => authenticated_queries(deps, msg, snip20)
    }
}

pub trait Snip20  {
    fn symbol_range(&self) -> RangeInclusive<usize> {
        3..=6
    }

    fn name_range(&self) -> RangeInclusive<usize> {
        3..=30
    }

    // Handle

    fn deposit<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
    ) -> StdResult<HandleResponse> {
        let mut amount = Uint128::zero();
    
        for coin in &env.message.sent_funds {
            if coin.denom == "uscrt" {
                amount = coin.amount
            } else {
                return Err(StdError::generic_err(
                    "Tried to deposit an unsupported token",
                ));
            }
        }
    
        if amount.is_zero() {
            return Err(StdError::generic_err("No funds were sent to be deposited"));
        }
    
        let raw_amount = amount.u128();
    
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;
        if !constants.deposit_is_enabled {
            return Err(StdError::generic_err(
                "Deposit functionality is not enabled for this token.",
            ));
        }
        let total_supply = config.total_supply();
        if let Some(total_supply) = total_supply.checked_add(raw_amount) {
            config.set_total_supply(total_supply);
        } else {
            return Err(StdError::generic_err(
                "This deposit would overflow the currency's total supply",
            ));
        }
    
        let sender_address = deps.api.canonical_address(&env.message.sender)?;
    
        let mut balances = Balances::from_storage(&mut deps.storage);
        let account_balance = balances.balance(&sender_address);
        if let Some(account_balance) = account_balance.checked_add(raw_amount) {
            balances.set_account_balance(&sender_address, account_balance);
        } else {
            return Err(StdError::generic_err(
                "This deposit would overflow your balance",
            ));
        }
    
        store_deposit(
            &mut deps.storage,
            &sender_address,
            amount,
            "uscrt".to_string(),
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Deposit { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }
    
    fn redeem<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        amount: Uint128,
    ) -> StdResult<HandleResponse> {
        let config = ReadonlyConfig::from_storage(&deps.storage);
        let constants = config.constants()?;
        if !constants.redeem_is_enabled {
            return Err(StdError::generic_err(
                "Redeem functionality is not enabled for this token.",
            ));
        }
    
        let sender_address = deps.api.canonical_address(&env.message.sender)?;
        let amount_raw = amount.u128();
    
        let mut balances = Balances::from_storage(&mut deps.storage);
        let account_balance = balances.balance(&sender_address);
    
        if let Some(account_balance) = account_balance.checked_sub(amount_raw) {
            balances.set_account_balance(&sender_address, account_balance);
        } else {
            return Err(StdError::generic_err(format!(
                "insufficient funds to redeem: balance={}, required={}",
                account_balance, amount_raw
            )));
        }
    
        let mut config = Config::from_storage(&mut deps.storage);
        let total_supply = config.total_supply();
        if let Some(total_supply) = total_supply.checked_sub(amount_raw) {
            config.set_total_supply(total_supply);
        } else {
            return Err(StdError::generic_err(
                "You are trying to redeem more tokens than what is available in the total supply",
            ));
        }
    
        let token_reserve = deps
            .querier
            .query_balance(&env.contract.address, "uscrt")?
            .amount;
        if amount > token_reserve {
            return Err(StdError::generic_err(
                "You are trying to redeem for more SCRT than the token has in its deposit reserve.",
            ));
        }
    
        let withdrawal_coins: Vec<Coin> = vec![Coin {
            denom: "uscrt".to_string(),
            amount,
        }];
    
        store_redeem(
            &mut deps.storage,
            &sender_address,
            amount,
            constants.symbol,
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages: vec![CosmosMsg::Bank(BankMsg::Send {
                from_address: env.contract.address,
                to_address: env.message.sender,
                amount: withdrawal_coins,
            })],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Redeem { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }

    fn transfer<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        recipient: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<HandleResponse> {
        let sender = deps.api.canonical_address(&env.message.sender)?;
        let recipient = deps.api.canonical_address(&recipient)?;

        transfer_impl(deps, &sender, &recipient, amount, memo, &env.block)?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Transfer { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn send<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        recipient: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
    ) -> StdResult<HandleResponse> {
        let mut messages = vec![];
        let sender = env.message.sender;
        let sender_canon = deps.api.canonical_address(&sender)?;
        send_impl(
            deps,
            &mut messages,
            sender,
            &sender_canon,
            recipient,
            amount,
            memo,
            msg,
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages,
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Send { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn burn<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<HandleResponse> {
        let config = ReadonlyConfig::from_storage(&deps.storage);
        let constants = config.constants()?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }
    
        let sender_address = deps.api.canonical_address(&env.message.sender)?;
        let raw_amount = amount.u128();
    
        let mut balances = Balances::from_storage(&mut deps.storage);
        let mut account_balance = balances.balance(&sender_address);
    
        if let Some(new_account_balance) = account_balance.checked_sub(raw_amount) {
            account_balance = new_account_balance;
        } else {
            return Err(StdError::generic_err(format!(
                "insufficient funds to burn: balance={}, required={}",
                account_balance, raw_amount
            )));
        }
    
        balances.set_account_balance(&sender_address, account_balance);
    
        let mut config = Config::from_storage(&mut deps.storage);
        let mut total_supply = config.total_supply();
        if let Some(new_total_supply) = total_supply.checked_sub(raw_amount) {
            total_supply = new_total_supply;
        } else {
            return Err(StdError::generic_err(
                "You're trying to burn more than is available in the total supply",
            ));
        }
        config.set_total_supply(total_supply);
    
        store_burn(
            &mut deps.storage,
            &sender_address,
            &sender_address,
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Burn { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }

    fn register_receive<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        code_hash: String,
    ) -> StdResult<HandleResponse> {
        set_receiver_hash(&mut deps.storage, &env.message.sender, code_hash);

        let res = HandleResponse {
            messages: vec![],
            log: vec![log("register_status", "success")],
            data: Some(to_binary(&HandleAnswer::RegisterReceive {
                status: ResponseStatus::Success,
            })?),
        };

        Ok(res)
    }

    fn set_viewing_key<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        key: String,
    ) -> StdResult<HandleResponse> {
        let vk = ViewingKey(key);
    
        let message_sender = deps.api.canonical_address(&env.message.sender)?;
        write_viewing_key(&mut deps.storage, &message_sender, &vk);
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::SetViewingKey { status: ResponseStatus::Success })?),
        })
    }
    
    fn create_viewing_key<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        entropy: String,
    ) -> StdResult<HandleResponse> {
        let constants = ReadonlyConfig::from_storage(&deps.storage).constants()?;
        let prng_seed = constants.prng_seed;
    
        let key = ViewingKey::new(&env, &prng_seed, (&entropy).as_ref());
    
        let message_sender = deps.api.canonical_address(&env.message.sender)?;
        write_viewing_key(&mut deps.storage, &message_sender, &key);
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::CreateViewingKey { key })?),
        })
    }

    fn increase_allowance<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        spender: HumanAddr,
        amount: Uint128,
        expiration: Option<u64>,
    ) -> StdResult<HandleResponse> {
        let owner_address = deps.api.canonical_address(&env.message.sender)?;
        let spender_address = deps.api.canonical_address(&spender)?;
    
        let mut allowance = read_allowance(&deps.storage, &owner_address, &spender_address)?;
    
        // If the previous allowance has expired, reset the allowance.
        // Without this users can take advantage of an expired allowance given to
        // them long ago.
        if allowance.is_expired_at(&env.block) {
            allowance.amount = amount.u128();
            allowance.expiration = None;
        } else {
            allowance.amount = allowance.amount.saturating_add(amount.u128());
        }
    
        if expiration.is_some() {
            allowance.expiration = expiration;
        }
        let new_amount = allowance.amount;
        write_allowance(
            &mut deps.storage,
            &owner_address,
            &spender_address,
            allowance,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::IncreaseAllowance {
                owner: env.message.sender,
                spender,
                allowance: Uint128(new_amount),
            })?),
        };
        Ok(res)
    }
    
    fn decrease_allowance<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        spender: HumanAddr,
        amount: Uint128,
        expiration: Option<u64>,
    ) -> StdResult<HandleResponse> {
        let owner_address = deps.api.canonical_address(&env.message.sender)?;
        let spender_address = deps.api.canonical_address(&spender)?;
    
        let mut allowance = read_allowance(&deps.storage, &owner_address, &spender_address)?;
    
        // If the previous allowance has expired, reset the allowance.
        // Without this users can take advantage of an expired allowance given to
        // them long ago.
        if allowance.is_expired_at(&env.block) {
            allowance.amount = 0;
            allowance.expiration = None;
        } else {
            allowance.amount = allowance.amount.saturating_sub(amount.u128());
        }
    
        if expiration.is_some() {
            allowance.expiration = expiration;
        }
        let new_amount = allowance.amount;
        write_allowance(
            &mut deps.storage,
            &owner_address,
            &spender_address,
            allowance,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::DecreaseAllowance {
                owner: env.message.sender,
                spender,
                allowance: Uint128(new_amount),
            })?),
        };
        Ok(res)
    }

    fn transfer_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        owner: HumanAddr,
        recipient: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<HandleResponse> {
        let spender = deps.api.canonical_address(&env.message.sender)?;
        let owner = deps.api.canonical_address(&owner)?;
        let recipient = deps.api.canonical_address(&recipient)?;

        transfer_from_impl(deps, &env, &spender, &owner, &recipient, amount, memo)?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::TransferFrom { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn send_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        owner: HumanAddr,
        recipient: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
    ) -> StdResult<HandleResponse> {
        let spender = &env.message.sender;
        let spender_canon = deps.api.canonical_address(spender)?;
    
        let mut messages = vec![];

        send_from_impl(
            deps,
            env,
            &mut messages,
            &spender_canon,
            owner,
            recipient,
            amount,
            memo,
            msg,
        )?;
    
        let res = HandleResponse {
            messages,
            log: vec![],
            data: Some(to_binary(&HandleAnswer::SendFrom { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn burn_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        owner: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<HandleResponse> {
        let config = ReadonlyConfig::from_storage(&deps.storage);
        let constants = config.constants()?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }
    
        let spender = deps.api.canonical_address(&env.message.sender)?;
        let owner = deps.api.canonical_address(&owner)?;
        let raw_amount = amount.u128();

        use_allowance(&mut deps.storage, &env, &owner, &spender, raw_amount)?;
    
        // subtract from owner account
        let mut balances = Balances::from_storage(&mut deps.storage);
        let mut account_balance = balances.balance(&owner);
    
        if let Some(new_balance) = account_balance.checked_sub(raw_amount) {
            account_balance = new_balance;
        } else {
            return Err(StdError::generic_err(format!(
                "insufficient funds to burn: balance={}, required={}",
                account_balance, raw_amount
            )));
        }
        balances.set_account_balance(&owner, account_balance);
    
        // remove from supply
        let mut config = Config::from_storage(&mut deps.storage);
        let mut total_supply = config.total_supply();
        if let Some(new_total_supply) = total_supply.checked_sub(raw_amount) {
            total_supply = new_total_supply;
        } else {
            return Err(StdError::generic_err(
                "You're trying to burn more than is available in the total supply",
            ));
        }
        config.set_total_supply(total_supply);
    
        store_burn(
            &mut deps.storage,
            &owner,
            &spender,
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BurnFrom { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }
    
    fn mint<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        recipient: HumanAddr,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }
    
        let minters = config.minters();
        if !minters.contains(&env.message.sender) {
            return Err(StdError::generic_err(
                "Minting is allowed to minter accounts only",
            ));
        }
    
        let mut total_supply = config.total_supply();
        if let Some(new_total_supply) = total_supply.checked_add(amount.u128()) {
            total_supply = new_total_supply;
        } else {
            return Err(StdError::generic_err(
                "This mint attempt would increase the total supply above the supported maximum",
            ));
        }
        config.set_total_supply(total_supply);
    
        let minter = &deps.api.canonical_address(&env.message.sender)?;
        let recipient = &deps.api.canonical_address(&recipient)?;

        mint_impl(
            &mut deps.storage,
            &minter,
            &recipient,
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::Mint { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }

    fn change_admin<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        address: HumanAddr,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
    
        check_if_admin(&config, &env.message.sender)?;
    
        let mut consts = config.constants()?;
        consts.admin = address;
        config.set_constants(&consts)?;
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::ChangeAdmin { status: ResponseStatus::Success })?),
        })
    }

    fn set_contract_status<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        status_level: ContractStatusLevel,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
    
        check_if_admin(&config, &env.message.sender)?;
    
        config.set_contract_status(status_level);
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::SetContractStatus {
                status: ResponseStatus::Success,
            })?),
        })
    }

    fn add_minters<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        minters_to_add: Vec<HumanAddr>,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;

        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }
    
        check_if_admin(&config, &env.message.sender)?;
    
        config.add_minters(minters_to_add)?;
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::AddMinters { status: ResponseStatus::Success })?),
        })
    }

    fn remove_minters<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        minters_to_remove: Vec<HumanAddr>,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }
    
        check_if_admin(&config, &env.message.sender)?;
    
        config.remove_minters(minters_to_remove)?;
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::RemoveMinters { status: ResponseStatus::Success })?),
        })
    }

    fn set_minters<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        minters_to_set: Vec<HumanAddr>,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }
    
        check_if_admin(&config, &env.message.sender)?;
    
        config.set_minters(minters_to_set)?;
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::SetMinters { status: ResponseStatus::Success })?),
        })
    }

    // SNIP22 Handle

    fn batch_transfer<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::TransferAction>,
    ) -> StdResult<HandleResponse> {
        let sender = deps.api.canonical_address(&env.message.sender)?;

        for action in actions {
            let recipient = deps.api.canonical_address(&action.recipient)?;

            transfer_impl(
                deps,
                &sender,
                &recipient,
                action.amount,
                action.memo,
                &env.block,
            )?;
        }
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchTransfer { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn batch_send<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::SendAction>,
    ) -> StdResult<HandleResponse> {
        let mut messages = vec![];
        let sender = env.message.sender;
        let sender_canon = deps.api.canonical_address(&sender)?;

        for action in actions {
            send_impl(
                deps,
                &mut messages,
                sender.clone(),
                &sender_canon,
                action.recipient,
                action.amount,
                action.memo,
                action.msg,
                &env.block,
            )?;
        }
    
        let res = HandleResponse {
            messages,
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchSend { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn batch_transfer_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::TransferFromAction>,
    ) -> StdResult<HandleResponse> {
        let spender = deps.api.canonical_address(&env.message.sender)?;
        for action in actions {
            let owner = deps.api.canonical_address(&action.owner)?;
            let recipient = deps.api.canonical_address(&action.recipient)?;

            transfer_from_impl(
                deps,
                &env,
                &spender,
                &owner,
                &recipient,
                action.amount,
                action.memo,
            )?;
        }
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchTransferFrom {
                status: ResponseStatus::Success,
            })?),
        };
        Ok(res)
    }

    fn batch_send_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::SendFromAction>,
    ) -> StdResult<HandleResponse> {
        let spender = &env.message.sender;
        let spender_canon = deps.api.canonical_address(spender)?;
        let mut messages = vec![];
    
        for action in actions {
            send_from_impl(
                deps,
                env.clone(),
                &mut messages,
                &spender_canon,
                action.owner,
                action.recipient,
                action.amount,
                action.memo,
                action.msg,
            )?;
        }
    
        let res = HandleResponse {
            messages,
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchSendFrom { status: ResponseStatus::Success })?),
        };
        Ok(res)
    }

    fn batch_burn_from<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::BurnFromAction>,
    ) -> StdResult<HandleResponse> {
        let config = ReadonlyConfig::from_storage(&deps.storage);
        let constants = config.constants()?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }
    
        let spender = deps.api.canonical_address(&env.message.sender)?;
    
        let mut total_supply = config.total_supply();
    
        for action in actions {
            let owner = deps.api.canonical_address(&action.owner)?;
            let amount = action.amount.u128();
            use_allowance(&mut deps.storage, &env, &owner, &spender, amount)?;
    
            // subtract from owner account
            let mut balances = Balances::from_storage(&mut deps.storage);
            let mut account_balance = balances.balance(&owner);
    
            if let Some(new_balance) = account_balance.checked_sub(amount) {
                account_balance = new_balance;
            } else {
                return Err(StdError::generic_err(format!(
                    "insufficient funds to burn: balance={}, required={}",
                    account_balance, amount
                )));
            }
            balances.set_account_balance(&owner, account_balance);
    
            // remove from supply
            if let Some(new_total_supply) = total_supply.checked_sub(amount) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(format!(
                    "You're trying to burn more than is available in the total supply: {:?}",
                    action
                )));
            }
    
            store_burn(
                &mut deps.storage,
                &owner,
                &spender,
                action.amount,
                constants.symbol.clone(),
                action.memo,
                &env.block,
            )?;
        }
    
        let mut config = Config::from_storage(&mut deps.storage);
        config.set_total_supply(total_supply);
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchBurnFrom { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }

    fn batch_mint<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        actions: Vec<batch::MintAction>,
    ) -> StdResult<HandleResponse> {
        let mut config = Config::from_storage(&mut deps.storage);
        let constants = config.constants()?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }
    
        let minters = config.minters();
        if !minters.contains(&env.message.sender) {
            return Err(StdError::generic_err(
                "Minting is allowed to minter accounts only",
            ));
        }
    
        let mut total_supply = config.total_supply();
    
        // Quick loop to check that the total of amounts is valid
        for action in &actions {
            if let Some(new_total_supply) = total_supply.checked_add(action.amount.u128()) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(
                    format!("This mint attempt would increase the total supply above the supported maximum: {:?}", action),
                ));
            }
        }
        config.set_total_supply(total_supply);
    
        let minter = &deps.api.canonical_address(&env.message.sender)?;
        for action in actions {
            let recipient = &deps.api.canonical_address(&action.recipient)?;

            mint_impl(
                &mut deps.storage,
                &minter,
                &recipient,
                action.amount,
                constants.symbol.clone(),
                action.memo,
                &env.block,
            )?;
        }
    
        let res = HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&HandleAnswer::BatchMint { status: ResponseStatus::Success })?),
        };
    
        Ok(res)
    }

    // Query

    fn query_exchange_rate(&self, storage: &impl ReadonlyStorage) -> StdResult<Binary> {
        let config = ReadonlyConfig::from_storage(storage);
        let constants = config.constants()?;
    
        if constants.deposit_is_enabled || constants.redeem_is_enabled {
            let rate: Uint128;
            let denom: String;
            // if token has more decimals than SCRT, you get magnitudes of SCRT per token
            if constants.decimals >= 6 {
                rate = Uint128(10u128.pow(constants.decimals as u32 - 6));
                denom = "SCRT".to_string();
            // if token has less decimals, you get magnitudes token for SCRT
            } else {
                rate = Uint128(10u128.pow(6 - constants.decimals as u32));
                denom = constants.symbol;
            }
            return to_binary(&QueryAnswer::ExchangeRate { rate, denom });
        }
        to_binary(&QueryAnswer::ExchangeRate {
            rate: Uint128(0),
            denom: String::new(),
        })
    }
    
    fn query_token_info(&self, storage: &impl ReadonlyStorage) -> StdResult<Binary> {
        let config = ReadonlyConfig::from_storage(storage);
        let constants = config.constants()?;
    
        let total_supply = if constants.total_supply_is_public {
            Some(Uint128(config.total_supply()))
        } else {
            None
        };
    
        to_binary(&QueryAnswer::TokenInfo {
            name: constants.name,
            symbol: constants.symbol,
            decimals: constants.decimals,
            total_supply,
        })
    }

    fn query_contract_status<S: ReadonlyStorage>(&self, storage: &S) -> StdResult<Binary> {
        let config = ReadonlyConfig::from_storage(storage);
    
        to_binary(&QueryAnswer::ContractStatus {
            status: config.contract_status(),
        })
    }

    fn query_minters<S: Storage, A: Api, Q: Querier>(&self, deps: &Extern<S, A, Q>) -> StdResult<Binary> {
        let minters = ReadonlyConfig::from_storage(&deps.storage).minters();
    
        let response = QueryAnswer::Minters { minters };
        to_binary(&response)
    }

    fn query_balance<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
        account: &HumanAddr,
    ) -> StdResult<Binary> {
        let address = deps.api.canonical_address(account)?;
    
        let amount = Uint128(ReadonlyBalances::from_storage(&deps.storage).account_amount(&address));
        let response = QueryAnswer::Balance { amount };
        to_binary(&response)
    }

    fn query_allowance<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
        owner: HumanAddr,
        spender: HumanAddr,
    ) -> StdResult<Binary> {
        let owner_address = deps.api.canonical_address(&owner)?;
        let spender_address = deps.api.canonical_address(&spender)?;
    
        let allowance = read_allowance(&deps.storage, &owner_address, &spender_address)?;
    
        let response = QueryAnswer::Allowance {
            owner,
            spender,
            allowance: Uint128(allowance.amount),
            expiration: allowance.expiration,
        };
        to_binary(&response)
    }

    // SNIP21 Query 

    fn query_transfers<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
        account: &HumanAddr,
        page: u32,
        page_size: u32,
    ) -> StdResult<Binary> {
        let address = deps.api.canonical_address(account)?;
        let (txs, total) = get_transfers(&deps.api, &deps.storage, &address, page, page_size)?;
    
        let result = QueryAnswer::TransferHistory {
            txs,
            total: Some(total),
        };
        to_binary(&result)
    }
    
    fn query_transactions<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
        account: &HumanAddr,
        page: u32,
        page_size: u32,
    ) -> StdResult<Binary> {
        let address = deps.api.canonical_address(account)?;
        let (txs, total) = get_txs(&deps.api, &deps.storage, &address, page, page_size)?;
    
        let result = QueryAnswer::TransactionHistory {
            txs,
            total: Some(total),
        };
        to_binary(&result)
    }
}

pub fn transfer_impl<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    sender: &CanonicalAddr,
    recipient: &CanonicalAddr,
    amount: Uint128,
    memo: Option<String>,
    block: &cosmwasm_std::BlockInfo,
) -> StdResult<()> {
    perform_transfer(&mut deps.storage, &sender, &recipient, amount.u128())?;

    let symbol = Config::from_storage(&mut deps.storage).constants()?.symbol;

    store_transfer(
        &mut deps.storage,
        &sender,
        &sender,
        &recipient,
        amount,
        symbol,
        memo,
        block,
    )?;

    Ok(())
}

pub fn perform_transfer<T: Storage>(
    store: &mut T,
    from: &CanonicalAddr,
    to: &CanonicalAddr,
    amount: u128,
) -> StdResult<()> {
    let mut balances = Balances::from_storage(store);

    let mut from_balance = balances.balance(from);
    if let Some(new_from_balance) = from_balance.checked_sub(amount) {
        from_balance = new_from_balance;
    } else {
        return Err(StdError::generic_err(format!(
            "insufficient funds: balance={}, required={}",
            from_balance, amount
        )));
    }
    balances.set_account_balance(from, from_balance);

    let mut to_balance = balances.balance(to);
    to_balance = to_balance.checked_add(amount).ok_or_else(|| {
        StdError::generic_err("This tx will literally make them too rich. Try transferring less")
    })?;
    balances.set_account_balance(to, to_balance);

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn send_impl<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    messages: &mut Vec<CosmosMsg>,
    sender: HumanAddr,
    sender_canon: &CanonicalAddr, // redundant but more efficient
    recipient: HumanAddr,
    amount: Uint128,
    memo: Option<String>,
    msg: Option<Binary>,
    block: &cosmwasm_std::BlockInfo,
) -> StdResult<()> {
    let recipient_canon = deps.api.canonical_address(&recipient)?;

    transfer_impl(
        deps,
        &sender_canon,
        &recipient_canon,
        amount,
        memo.clone(),
        block,
    )?;

    add_receiver_api_callback(
        &deps.storage,
        messages,
        recipient,
        msg,
        sender.clone(),
        sender,
        amount,
        memo,
    )?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn add_receiver_api_callback<S: ReadonlyStorage>(
    storage: &S,
    messages: &mut Vec<CosmosMsg>,
    recipient: HumanAddr,
    msg: Option<Binary>,
    sender: HumanAddr,
    from: HumanAddr,
    amount: Uint128,
    memo: Option<String>,
) -> StdResult<()> {
    let receiver_hash = get_receiver_hash(storage, &recipient);
    if let Some(receiver_hash) = receiver_hash {
        let receiver_hash = receiver_hash?;
        let receiver_msg = Snip20ReceiveMsg::new(sender, from, amount, memo, msg);
        let callback_msg = receiver_msg.into_cosmos_msg(receiver_hash, recipient)?;

        messages.push(callback_msg);
    }
    Ok(())
}

pub fn transfer_from_impl<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: &Env,
    spender: &CanonicalAddr,
    owner: &CanonicalAddr,
    recipient: &CanonicalAddr,
    amount: Uint128,
    memo: Option<String>,
) -> StdResult<()> {
    let raw_amount = amount.u128();

    use_allowance(&mut deps.storage, env, owner, spender, raw_amount)?;

    perform_transfer(&mut deps.storage, owner, recipient, raw_amount)?;

    let symbol = Config::from_storage(&mut deps.storage).constants()?.symbol;

    store_transfer(
        &mut deps.storage,
        owner,
        spender,
        recipient,
        amount,
        symbol,
        memo,
        &env.block,
    )?;

    Ok(())
}

pub fn use_allowance<S: Storage>(
    storage: &mut S,
    env: &Env,
    owner: &CanonicalAddr,
    spender: &CanonicalAddr,
    amount: u128,
) -> StdResult<()> {
    let mut allowance = read_allowance(storage, owner, spender)?;

    if allowance.is_expired_at(&env.block) {
        return Err(insufficient_allowance(0, amount));
    }
    if let Some(new_allowance) = allowance.amount.checked_sub(amount) {
        allowance.amount = new_allowance;
    } else {
        return Err(insufficient_allowance(allowance.amount, amount));
    }

    write_allowance(storage, owner, spender, allowance)?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn send_from_impl<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    messages: &mut Vec<CosmosMsg>,
    spender_canon: &CanonicalAddr, // redundant but more efficient
    owner: HumanAddr,
    recipient: HumanAddr,
    amount: Uint128,
    memo: Option<String>,
    msg: Option<Binary>,
) -> StdResult<()> {
    let owner_canon = deps.api.canonical_address(&owner)?;
    let recipient_canon = deps.api.canonical_address(&recipient)?;

    transfer_from_impl(
        deps,
        &env,
        &spender_canon,
        &owner_canon,
        &recipient_canon,
        amount,
        memo.clone(),
    )?;

    add_receiver_api_callback(
        &deps.storage,
        messages,
        recipient,
        msg,
        env.message.sender,
        owner,
        amount,
        memo,
    )?;

    Ok(())
}

pub fn mint_impl<S: Storage>(
    storage: &mut S,
    minter: &CanonicalAddr,
    recipient: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &cosmwasm_std::BlockInfo,
) -> StdResult<()> {
    let raw_amount = amount.u128();

    let mut balances = Balances::from_storage(storage);

    let mut account_balance = balances.balance(recipient);

    if let Some(new_balance) = account_balance.checked_add(raw_amount) {
        account_balance = new_balance;
    } else {
        // This error literally can not happen, since the account's funds are a subset
        // of the total supply, both are stored as u128, and we check for overflow of
        // the total supply just a couple lines before.
        // Still, writing this to cover all overflows.
        return Err(StdError::generic_err(
            "This mint attempt would increase the account's balance above the supported maximum",
        ));
    }

    balances.set_account_balance(recipient, account_balance);

    store_mint(storage, minter, recipient, amount, denom, memo, block)?;

    Ok(())
}

pub fn check_if_admin<S: Storage>(config: &Config<S>, account: &HumanAddr) -> StdResult<()> {
    if !is_admin(config, account)? {
        return Err(StdError::generic_err(
            "This is an admin command. Admin commands can only be run from admin address",
        ));
    }

    Ok(())
}

pub fn assert_valid_name(name: &str, range: RangeInclusive<usize>) -> StdResult<()> {
    if range.contains(&name.len()) {
        return Ok(());
    }

    Err(StdError::generic_err(
        format!(
            "Name is not in the expected format ({}-{} UTF-8 bytes)",
            range.start(),
            range.end()
        ),
    ))
}

pub fn assert_valid_symbol(symbol: &str, range: RangeInclusive<usize>) -> StdResult<()> {
    let len = symbol.len();
    let len_is_valid = range.contains(&len);

    if len_is_valid && symbol.bytes().all(|byte| (b'A'..=b'Z').contains(&byte)) {
        return Ok(())
    }
    
    return Err(StdError::generic_err(
        format!(
            "Ticker symbol is not in expected format [A-Z]{{{},{}}}",
            range.start(),
            range.end()
        )
    ));
}

fn authenticated_queries<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
    snip20: impl Snip20
) -> StdResult<Binary> {
    let (addresses, key) = msg.get_validation_params();

    for address in addresses {
        let canonical_addr = deps.api.canonical_address(address)?;

        let expected_key = read_viewing_key(&deps.storage, &canonical_addr);

        if expected_key.is_none() {
            // Checking the key will take significant time. We don't want to exit immediately if it isn't set
            // in a way which will allow to time the command and determine if a viewing key doesn't exist
            key.check_viewing_key(&[0u8; VIEWING_KEY_SIZE]);
        } else if key.check_viewing_key(expected_key.unwrap().as_slice()) {
            return match msg {
                // Base
                QueryMsg::Balance { address, .. } => snip20.query_balance(&deps, &address),
                QueryMsg::TransferHistory {
                    address,
                    page,
                    page_size,
                    ..
                } => snip20.query_transfers(&deps, &address, page.unwrap_or(0), page_size),
                QueryMsg::TransactionHistory {
                    address,
                    page,
                    page_size,
                    ..
                } => snip20.query_transactions(&deps, &address, page.unwrap_or(0), page_size),
                QueryMsg::Allowance { owner, spender, .. } => snip20.query_allowance(deps, owner, spender),
                _ => panic!("This query type does not require authentication"),
            };
        }
    }

    Ok(to_binary(&QueryAnswer::ViewingKeyError {
        msg: "Wrong viewing key for this address or viewing key not set".to_string(),
    })?)
}

fn is_admin<S: Storage>(config: &Config<S>, account: &HumanAddr) -> StdResult<bool> {
    let consts = config.constants()?;
    if &consts.admin != account {
        return Ok(false);
    }

    Ok(true)
}

fn insufficient_allowance(allowance: u128, required: u128) -> StdError {
    StdError::generic_err(format!(
        "insufficient allowance: allowance={}, required={}",
        allowance, required
    ))
}

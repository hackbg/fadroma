use crate::{
    prelude::*,
    vk::VIEWING_KEY_SIZE,
    snip20::client::msg::{
        ExecuteAnswer, ExecuteMsg, QueryAnswer, QueryMsg, QueryPermission,
        QueryWithPermit, ResponseStatus, ContractStatusLevel, MintAction,
        SendAction, BurnFromAction, SendFromAction, TransferFromAction,
        TransferAction, TokenInfo
    }
};

use super::{
    msg::InstantiateMsg,
    receiver::Snip20ReceiveMsg,
    state::{get_admin, set_admin, Account, Allowance, Config, Constants},
    transaction_history::{
        get_transfers, get_txs, store_burn, store_deposit, store_mint, store_redeem, store_transfer,
    },
    utils::pad_response,
};
use std::fmt;
use std::fmt::Write;
use std::ops::RangeInclusive;

pub fn snip20_instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
    snip20: impl Snip20,
) -> StdResult<Response> {
    // Check name, symbol, decimals
    assert_valid_name(&msg.name, snip20.name_range())?;
    assert_valid_symbol(&msg.symbol, snip20.symbol_validation())?;

    if msg.decimals > 18 {
        return Err(StdError::generic_err("Decimals must not exceed 18"));
    }

    let init_config = msg.config.unwrap_or_default();

    let admin = match msg.admin {
        Some(admin) => deps.api.addr_canonicalize(&admin)?,
        None => deps.api.addr_canonicalize(info.sender.as_str())?,
    };

    let mut total_supply = Uint128::zero();
    {
        let initial_balances = msg.initial_balances.unwrap_or_default();

        for balance in initial_balances {
            let account = Account::of(deps.api.addr_canonicalize(&balance.address)?);
            account.add_balance(deps.storage, balance.amount)?;

            if let Ok(new_total_supply) = total_supply.checked_add(balance.amount) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(
                    "The sum of all initial balances exceeds the maximum possible total supply",
                ));
            }

            store_mint(
                deps.storage,
                &admin,
                account.addr(),
                balance.amount,
                msg.symbol.clone(),
                Some("Initial Balance".to_string()),
                &env.block,
            )?;
        }
    }

    let prng_seed_hashed = sha_256(&msg.prng_seed.0);

    Config::set_constants(
        deps.storage,
        &Constants {
            name: msg.name,
            symbol: msg.symbol,
            decimals: msg.decimals,
            prng_seed: prng_seed_hashed.to_vec(),
            total_supply_is_public: init_config.public_total_supply(),
            deposit_is_enabled: init_config.deposit_enabled(),
            redeem_is_enabled: init_config.redeem_enabled(),
            mint_is_enabled: init_config.mint_enabled(),
            burn_is_enabled: init_config.burn_enabled(),
        },
    )?;

    Config::increase_total_supply(deps.storage, total_supply)?;
    Config::set_contract_status(deps.storage, ContractStatusLevel::NormalRun)?;

    set_admin(deps.storage, &admin)?;

    let minters = if init_config.mint_enabled() {
        Vec::from([admin])
    } else {
        Vec::new()
    };

    Config::set_minters(deps.storage, minters)?;

    let mut messages = vec![];

    if let Some(callback) = msg.callback {
        messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: callback.contract.address,
            code_hash: callback.contract.code_hash,
            msg: callback.msg,
            funds: vec![],
        }))
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("token_address", env.contract.address)
        .add_attribute("token_code_hash", env.contract.code_hash))
}

pub fn snip20_execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
    snip20: impl Snip20,
) -> StdResult<Response> {
    let contract_status = Config::get_contract_status(deps.storage)?;

    match contract_status {
        ContractStatusLevel::StopAll | ContractStatusLevel::StopAllButRedeems => {
            let response = match msg {
                ExecuteMsg::SetContractStatus { level, .. } => {
                    snip20.set_contract_status(deps, env, info, level)
                }
                ExecuteMsg::Redeem { amount, .. }
                    if contract_status == ContractStatusLevel::StopAllButRedeems =>
                {
                    snip20.redeem(deps, env, info, amount)
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
        ExecuteMsg::Deposit { .. } => snip20.deposit(deps, env, info),
        ExecuteMsg::Redeem { amount, .. } => snip20.redeem(deps, env, info, amount),

        // Base
        ExecuteMsg::Transfer {
            recipient,
            amount,
            memo,
            ..
        } => snip20.transfer(deps, env, info, recipient, amount, memo),
        ExecuteMsg::Send {
            recipient,
            recipient_code_hash,
            amount,
            msg,
            memo,
            ..
        } => snip20.send(
            deps,
            env,
            info,
            recipient,
            recipient_code_hash,
            amount,
            memo,
            msg,
        ),
        ExecuteMsg::Burn { amount, memo, .. } => snip20.burn(deps, env, info, amount, memo),
        ExecuteMsg::RegisterReceive { code_hash, .. } => {
            snip20.register_receive(deps, env, info, code_hash)
        }
        ExecuteMsg::CreateViewingKey { entropy, .. } => {
            snip20.create_viewing_key(deps, env, info, entropy)
        }
        ExecuteMsg::SetViewingKey { key, .. } => snip20.set_viewing_key(deps, env, info, key),

        // Allowance
        ExecuteMsg::IncreaseAllowance {
            spender,
            amount,
            expiration,
            ..
        } => snip20.increase_allowance(deps, env, info, spender, amount, expiration),
        ExecuteMsg::DecreaseAllowance {
            spender,
            amount,
            expiration,
            ..
        } => snip20.decrease_allowance(deps, env, info, spender, amount, expiration),
        ExecuteMsg::TransferFrom {
            owner,
            recipient,
            amount,
            memo,
            ..
        } => snip20.transfer_from(deps, env, info, owner, recipient, amount, memo),
        ExecuteMsg::SendFrom {
            owner,
            recipient,
            recipient_code_hash,
            amount,
            msg,
            memo,
            ..
        } => snip20.send_from(
            deps,
            env,
            info,
            owner,
            recipient,
            recipient_code_hash,
            amount,
            memo,
            msg,
        ),
        ExecuteMsg::BurnFrom {
            owner,
            amount,
            memo,
            ..
        } => snip20.burn_from(deps, env, info, owner, amount, memo),

        // Mint
        ExecuteMsg::Mint {
            recipient,
            amount,
            memo,
            ..
        } => snip20.mint(deps, env, info, recipient, amount, memo),

        // Other
        ExecuteMsg::ChangeAdmin { address, .. } => snip20.change_admin(deps, env, info, address),
        ExecuteMsg::SetContractStatus { level, .. } => {
            snip20.set_contract_status(deps, env, info, level)
        }
        ExecuteMsg::AddMinters { minters, .. } => snip20.add_minters(deps, env, info, minters),
        ExecuteMsg::RemoveMinters { minters, .. } => {
            snip20.remove_minters(deps, env, info, minters)
        }
        ExecuteMsg::SetMinters { minters, .. } => snip20.set_minters(deps, env, info, minters),

        // SNIP22
        ExecuteMsg::BatchTransfer { actions, .. } => {
            snip20.batch_transfer(deps, env, info, actions)
        }
        ExecuteMsg::BatchSend { actions, .. } => snip20.batch_send(deps, env, info, actions),
        ExecuteMsg::BatchTransferFrom { actions, .. } => {
            snip20.batch_transfer_from(deps, env, info, actions)
        }
        ExecuteMsg::BatchSendFrom { actions, .. } => {
            snip20.batch_send_from(deps, env, info, actions)
        }
        ExecuteMsg::BatchBurnFrom { actions, .. } => {
            snip20.batch_burn_from(deps, env, info, actions)
        }
        ExecuteMsg::BatchMint { actions, .. } => snip20.batch_mint(deps, env, info, actions),

        // SNIP24
        ExecuteMsg::RevokePermit { permit_name, .. } => {
            snip20.revoke_permit(deps, env, info, permit_name)
        }
    };

    pad_response(response)
}

pub fn snip20_query(deps: Deps, env: Env, msg: QueryMsg, snip20: impl Snip20) -> StdResult<Binary> {
    match msg {
        QueryMsg::TokenInfo {} => snip20.query_token_info(deps, env),
        QueryMsg::ContractStatus {} => snip20.query_contract_status(deps, env),
        QueryMsg::ExchangeRate {} => snip20.query_exchange_rate(deps, env),
        QueryMsg::Minters { .. } => snip20.query_minters(deps, env),
        QueryMsg::WithPermit { permit, query } => permit_queries(deps, env, snip20, permit, query),
        _ => viewing_keys_queries(deps, env, msg, snip20),
    }
}

pub trait Snip20 {
    fn symbol_validation(&self) -> SymbolValidation {
        SymbolValidation {
            length: 3..=6,
            allow_upper: true,
            allow_lower: false,
            allow_numeric: false,
            allowed_special: None,
        }
    }

    fn name_range(&self) -> RangeInclusive<usize> {
        3..=30
    }

    // Handle
    fn deposit(&self, deps: DepsMut, env: Env, info: MessageInfo) -> StdResult<Response> {
        let mut amount = Uint128::zero();

        for coin in &info.funds {
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

        let constants = Config::get_constants(deps.storage)?;
        if !constants.deposit_is_enabled {
            return Err(StdError::generic_err(
                "Deposit functionality is not enabled for this token.",
            ));
        }

        Config::increase_total_supply(deps.storage, amount)?;

        let account = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        account.add_balance(deps.storage, amount)?;

        store_deposit(
            deps.storage,
            &account.addr(),
            amount,
            "uscrt".to_string(),
            &env.block,
        )?;

        Ok(Response::new().set_data(to_binary(&ExecuteAnswer::Deposit {
            status: ResponseStatus::Success,
        })?))
    }

    fn redeem(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        amount: Uint128,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.redeem_is_enabled {
            return Err(StdError::generic_err(
                "Redeem functionality is not enabled for this token.",
            ));
        }

        let account = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        account.subtract_balance(deps.storage, amount)?;

        Config::decrease_total_supply(deps.storage, amount)?;

        let token_reserve = deps
            .querier
            .query_balance(env.contract.address, "uscrt")?
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
            deps.storage,
            &account.addr(),
            amount,
            constants.symbol,
            &env.block,
        )?;

        Ok(Response::new()
            .add_message(CosmosMsg::Bank(BankMsg::Send {
                to_address: info.sender.into_string(),
                amount: withdrawal_coins,
            }))
            .set_data(to_binary(&ExecuteAnswer::Redeem {
                status: ResponseStatus::Success,
            })?))
    }

    fn transfer(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<Response> {
        let sender = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        let recipient = Account::of(deps.api.addr_canonicalize(&recipient)?);

        transfer_impl(deps, &sender, &recipient, amount, memo, &env.block)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::Transfer {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn send(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
    ) -> StdResult<Response> {
        let sender_canon = deps.api.addr_canonicalize(info.sender.as_str())?;
        let sender = Account::of(sender_canon);
        let recipient = Account::of(deps.api.addr_canonicalize(&recipient)?);

        let messages = send_impl(
            deps,
            &sender,
            &recipient,
            recipient_code_hash,
            amount,
            memo,
            msg,
            &env.block,
        )?;

        Ok(Response::new()
            .add_messages(messages)
            .set_data(to_binary(&ExecuteAnswer::Send {
                status: ResponseStatus::Success,
            })?))
    }

    fn burn(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }

        let account = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        account.subtract_balance(deps.storage, amount)?;

        Config::decrease_total_supply(deps.storage, amount)?;

        store_burn(
            deps.storage,
            account.addr(),
            account.addr(),
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;

        Ok(Response::new().set_data(to_binary(&ExecuteAnswer::Burn {
            status: ResponseStatus::Success,
        })?))
    }

    fn register_receive(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        code_hash: String,
    ) -> StdResult<Response> {
        Account::of(deps.api.addr_canonicalize(info.sender.as_str())?)
            .set_receiver_hash(deps.storage, code_hash)?;

        Ok(Response::new()
            .add_attribute("register_status", "success")
            .set_data(to_binary(&ExecuteAnswer::RegisterReceive {
                status: ResponseStatus::Success,
            })?))
    }

    fn set_viewing_key(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        key: String,
    ) -> StdResult<Response> {
        Account::of(deps.api.addr_canonicalize(info.sender.as_str())?)
            .set_viewing_key(deps.storage, &ViewingKey(key))?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::SetViewingKey {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn create_viewing_key(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        entropy: String,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        let prng_seed = constants.prng_seed;

        let key = ViewingKey::new(&env, &info, &prng_seed, entropy.as_bytes());

        Account::of(deps.api.addr_canonicalize(info.sender.as_str())?)
            .set_viewing_key(deps.storage, &key)?;

        Ok(Response::new().set_data(to_binary(&ExecuteAnswer::CreateViewingKey { key })?))
    }

    fn increase_allowance(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
    ) -> StdResult<Response> {
        let account = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        let spender_canon = deps.api.addr_canonicalize(&spender)?;

        let new_allowance =
            account.update_allowance(deps.storage, &spender_canon, |allowance| {
                // If the previous allowance has expired, reset the allowance.
                // Without this users can take advantage of an expired allowance given to
                // them long ago.
                if allowance.is_expired_at(&env.block) {
                    allowance.amount = amount;
                    allowance.expiration = None;
                } else {
                    allowance.amount = allowance.amount.saturating_add(amount);
                }

                if expiration.is_some() {
                    allowance.expiration = expiration;
                }

                Ok(())
            })?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::IncreaseAllowance {
                owner: info.sender,
                spender: Addr::unchecked(spender),
                allowance: new_allowance.amount,
            })?),
        )
    }

    fn decrease_allowance(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
    ) -> StdResult<Response> {
        let account = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);
        let spender_canon = deps.api.addr_canonicalize(&spender)?;

        let new_allowance =
            account.update_allowance(deps.storage, &spender_canon, |allowance| {
                // If the previous allowance has expired, reset the allowance.
                // Without this users can take advantage of an expired allowance given to
                // them long ago.
                if allowance.is_expired_at(&env.block) {
                    allowance.amount = Uint128::zero();
                    allowance.expiration = None;
                } else {
                    allowance.amount = allowance.amount.saturating_sub(amount);
                }

                if expiration.is_some() {
                    allowance.expiration = expiration;
                }

                Ok(())
            })?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::DecreaseAllowance {
                owner: info.sender,
                spender: Addr::unchecked(spender),
                allowance: new_allowance.amount,
            })?),
        )
    }

    fn transfer_from(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        owner: String,
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<Response> {
        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;
        let owner = Account::of(deps.api.addr_canonicalize(&owner)?);
        let recipient = Account::of(deps.api.addr_canonicalize(&recipient)?);

        transfer_from_impl(deps, &env, &spender, &owner, &recipient, amount, memo)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::TransferFrom {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn send_from(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        owner: String,
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
    ) -> StdResult<Response> {
        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;
        let owner = Account::of(deps.api.addr_canonicalize(&owner)?);
        let recipient = Account::of(deps.api.addr_canonicalize(&recipient)?);

        let messages = send_from_impl(
            deps,
            &env,
            &spender,
            &owner,
            &recipient,
            recipient_code_hash,
            amount,
            memo,
            msg,
        )?;

        Ok(Response::new()
            .add_messages(messages)
            .set_data(to_binary(&ExecuteAnswer::SendFrom {
                status: ResponseStatus::Success,
            })?))
    }

    fn burn_from(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        owner: String,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }

        let owner = Account::of(deps.api.addr_canonicalize(&owner)?);

        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;
        use_allowance(deps.storage, &env, &owner, &spender, amount)?;

        owner.subtract_balance(deps.storage, amount)?;

        Config::decrease_total_supply(deps.storage, amount)?;

        store_burn(
            deps.storage,
            owner.addr(),
            &spender,
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::BurnFrom {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn mint(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }

        let minters = Config::get_minters(deps.as_ref())?;
        if !minters.contains(&info.sender) {
            return Err(StdError::generic_err(
                "Minting is allowed to minter accounts only",
            ));
        }

        Config::increase_total_supply(deps.storage, amount)?;

        let minter = deps.api.addr_canonicalize(info.sender.as_str())?;
        let recipient = Account::of(deps.api.addr_canonicalize(&recipient)?);

        mint_impl(
            deps.storage,
            &minter,
            &recipient,
            amount,
            constants.symbol,
            memo,
            &env.block,
        )?;

        Ok(Response::new().set_data(to_binary(&ExecuteAnswer::Mint {
            status: ResponseStatus::Success,
        })?))
    }

    fn change_admin(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        address: String,
    ) -> StdResult<Response> {
        check_if_admin(deps.as_ref(), &info.sender)?;

        set_admin(deps.storage, &deps.api.addr_canonicalize(&address)?)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::ChangeAdmin {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn set_contract_status(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        status_level: ContractStatusLevel,
    ) -> StdResult<Response> {
        check_if_admin(deps.as_ref(), &info.sender)?;

        Config::set_contract_status(deps.storage, status_level)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::SetContractStatus {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn add_minters(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        minters_to_add: Vec<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }

        check_if_admin(deps.as_ref(), &info.sender)?;

        let canonized_minters = canonize_addresses(deps.api, minters_to_add)?;

        Config::add_minters(deps.storage, canonized_minters)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::AddMinters {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn remove_minters(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        minters_to_remove: Vec<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }

        check_if_admin(deps.as_ref(), &info.sender)?;

        let canonized_minters = canonize_addresses(deps.api, minters_to_remove)?;

        Config::remove_minters(deps.storage, canonized_minters)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::RemoveMinters {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn set_minters(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        minters_to_set: Vec<String>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }

        check_if_admin(deps.as_ref(), &info.sender)?;

        let canonized_minters = canonize_addresses(deps.api, minters_to_set)?;

        Config::set_minters(deps.storage, canonized_minters)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::SetMinters {
                status: ResponseStatus::Success,
            })?),
        )
    }

    // SNIP22 Handle
    fn batch_transfer(
        &self,
        mut deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<TransferAction>,
    ) -> StdResult<Response> {
        let sender = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);

        for action in actions {
            let recipient = Account::of(deps.api.addr_canonicalize(&action.recipient)?);

            transfer_impl(
                deps.branch(),
                &sender,
                &recipient,
                action.amount,
                action.memo,
                &env.block,
            )?;
        }

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::BatchTransfer {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn batch_send(
        &self,
        mut deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<SendAction>,
    ) -> StdResult<Response> {
        let sender = Account::of(deps.api.addr_canonicalize(info.sender.as_str())?);

        let mut messages = Vec::with_capacity(actions.len());

        for action in actions {
            let recipient = Account::of(deps.api.addr_canonicalize(&action.recipient)?);

            let msgs = send_impl(
                deps.branch(),
                &sender,
                &recipient,
                None,
                action.amount,
                action.memo,
                action.msg,
                &env.block,
            )?;

            messages.extend(msgs);
        }

        Ok(Response::new()
            .add_messages(messages)
            .set_data(to_binary(&ExecuteAnswer::BatchSend {
                status: ResponseStatus::Success,
            })?))
    }

    fn batch_transfer_from(
        &self,
        mut deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<TransferFromAction>,
    ) -> StdResult<Response> {
        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;

        for action in actions {
            let owner = Account::of(deps.api.addr_canonicalize(&action.owner)?);
            let recipient = Account::of(deps.api.addr_canonicalize(&action.recipient)?);

            transfer_from_impl(
                deps.branch(),
                &env,
                &spender,
                &owner,
                &recipient,
                action.amount,
                action.memo,
            )?;
        }

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::BatchTransferFrom {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn batch_send_from(
        &self,
        mut deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<SendFromAction>,
    ) -> StdResult<Response> {
        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;

        let mut messages = Vec::with_capacity(actions.len());

        for action in actions {
            let owner = Account::of(deps.api.addr_canonicalize(&action.owner)?);
            let recipient = Account::of(deps.api.addr_canonicalize(&action.recipient)?);

            let msgs = send_from_impl(
                deps.branch(),
                &env,
                &spender,
                &owner,
                &recipient,
                None,
                action.amount,
                action.memo,
                action.msg,
            )?;

            messages.extend(msgs);
        }

        Ok(Response::new().add_messages(messages).set_data(to_binary(
            &ExecuteAnswer::BatchSendFrom {
                status: ResponseStatus::Success,
            },
        )?))
    }

    fn batch_burn_from(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<BurnFromAction>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.burn_is_enabled {
            return Err(StdError::generic_err(
                "Burn functionality is not enabled for this token.",
            ));
        }

        let spender = deps.api.addr_canonicalize(info.sender.as_str())?;

        let mut total_supply = Config::get_total_supply(deps.storage)?;

        for action in actions {
            let owner = Account::of(deps.api.addr_canonicalize(&action.owner)?);

            use_allowance(deps.storage, &env, &owner, &spender, action.amount)?;

            owner.subtract_balance(deps.storage, action.amount)?;

            // remove from supply
            if let Ok(new_total_supply) = total_supply.checked_sub(action.amount) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(format!(
                    "You're trying to burn more than is available in the total supply: {:?}",
                    action
                )));
            }

            store_burn(
                deps.storage,
                owner.addr(),
                &spender,
                action.amount,
                constants.symbol.clone(),
                action.memo,
                &env.block,
            )?;
        }

        Config::set_total_supply(deps.storage, total_supply)?;

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::BatchBurnFrom {
                status: ResponseStatus::Success,
            })?),
        )
    }

    fn batch_mint(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        actions: Vec<MintAction>,
    ) -> StdResult<Response> {
        let constants = Config::get_constants(deps.storage)?;
        if !constants.mint_is_enabled {
            return Err(StdError::generic_err(
                "Mint functionality is not enabled for this token.",
            ));
        }

        let minters = Config::get_minters(deps.as_ref())?;
        if !minters.contains(&info.sender) {
            return Err(StdError::generic_err(
                "Minting is allowed to minter accounts only",
            ));
        }

        let mut total_supply = Config::get_total_supply(deps.storage)?;

        // Quick loop to check that the total of amounts is valid
        for action in &actions {
            if let Ok(new_total_supply) = total_supply.checked_add(action.amount) {
                total_supply = new_total_supply;
            } else {
                return Err(StdError::generic_err(
                    format!("This mint attempt would increase the total supply above the supported maximum: {:?}", action),
                ));
            }
        }

        Config::set_total_supply(deps.storage, total_supply)?;

        let minter = deps.api.addr_canonicalize(info.sender.as_str())?;

        for action in actions {
            let recipient = Account::of(deps.api.addr_canonicalize(&action.recipient)?);

            mint_impl(
                deps.storage,
                &minter,
                &recipient,
                action.amount,
                constants.symbol.clone(),
                action.memo,
                &env.block,
            )?;
        }

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::BatchMint {
                status: ResponseStatus::Success,
            })?),
        )
    }

    // SNIP24

    fn revoke_permit(
        &self,
        deps: DepsMut,
        _env: Env,
        info: MessageInfo,
        permit_name: String,
    ) -> StdResult<Response> {
        Permit::<QueryPermission>::revoke(deps.storage, &info.sender, &permit_name);

        Ok(
            Response::new().set_data(to_binary(&ExecuteAnswer::RevokePemit {
                status: ResponseStatus::Success,
            })?),
        )
    }

    // Query

    fn query_exchange_rate(&self, deps: Deps, _env: Env) -> StdResult<Binary> {
        let constants = Config::get_constants(deps.storage)?;

        if constants.deposit_is_enabled || constants.redeem_is_enabled {
            let rate: Uint128;
            let denom: String;
            // if token has more decimals than SCRT, you get magnitudes of SCRT per token
            if constants.decimals >= 6 {
                rate = Uint128::new(10u128.pow(constants.decimals as u32 - 6));
                denom = "SCRT".to_string();
            // if token has less decimals, you get magnitudes token for SCRT
            } else {
                rate = Uint128::new(10u128.pow(6 - constants.decimals as u32));
                denom = constants.symbol;
            }
            return to_binary(&QueryAnswer::ExchangeRate { rate, denom });
        }
        to_binary(&QueryAnswer::ExchangeRate {
            rate: Uint128::new(0),
            denom: String::new(),
        })
    }

    fn query_token_info(&self, deps: Deps, _env: Env) -> StdResult<Binary> {
        let constants = Config::get_constants(deps.storage)?;

        let total_supply = if constants.total_supply_is_public {
            Some(Config::get_total_supply(deps.storage)?)
        } else {
            None
        };

        to_binary(&QueryAnswer::TokenInfo(TokenInfo {
            name: constants.name,
            symbol: constants.symbol,
            decimals: constants.decimals,
            total_supply,
        }))
    }

    fn query_contract_status(&self, deps: Deps, _env: Env) -> StdResult<Binary> {
        to_binary(&QueryAnswer::ContractStatus {
            status: Config::get_contract_status(deps.storage)?,
        })
    }

    fn query_minters(&self, deps: Deps, _env: Env) -> StdResult<Binary> {
        let response = QueryAnswer::Minters {
            minters: Config::get_minters(deps)?,
        };
        to_binary(&response)
    }

    fn query_balance(&self, deps: Deps, _env: Env, account: Account) -> StdResult<Binary> {
        let amount = account.get_balance(deps.storage)?;

        to_binary(&QueryAnswer::Balance { amount })
    }

    fn query_allowance(
        &self,
        deps: Deps,
        _env: Env,
        owner: CanonicalAddr,
        spender: CanonicalAddr,
    ) -> StdResult<Binary> {
        let account = Account::of(owner);
        let allowance = account.get_allowance(deps.storage, &spender)?;

        let response = QueryAnswer::Allowance {
            owner: deps.api.addr_humanize(account.addr())?,
            spender: deps.api.addr_humanize(&spender)?,
            allowance: allowance.amount,
            expiration: allowance.expiration,
        };

        to_binary(&response)
    }

    // SNIP21 Query

    fn query_transfers(
        &self,
        deps: Deps,
        _env: Env,
        account: Account,
        page: u32,
        page_size: u32,
    ) -> StdResult<Binary> {
        let (txs, total) = get_transfers(deps, account.addr(), page, page_size)?;

        let result = QueryAnswer::TransferHistory {
            txs,
            total: Some(total),
        };

        to_binary(&result)
    }

    fn query_transactions(
        &self,
        deps: Deps,
        _env: Env,
        account: Account,
        page: u32,
        page_size: u32,
    ) -> StdResult<Binary> {
        let (txs, total) = get_txs(deps, account.addr(), page, page_size)?;

        let result = QueryAnswer::TransactionHistory {
            txs,
            total: Some(total),
        };
        to_binary(&result)
    }
}

pub fn transfer_impl(
    deps: DepsMut,
    sender: &Account,
    recipient: &Account,
    amount: Uint128,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    perform_transfer(deps.storage, sender, recipient, amount)?;

    let symbol = Config::get_constants(deps.storage)?.symbol;

    store_transfer(
        deps.storage,
        sender.addr(),
        sender.addr(),
        recipient.addr(),
        amount,
        symbol,
        memo,
        block,
    )?;

    Ok(())
}

#[inline]
pub fn perform_transfer(
    storage: &mut dyn Storage,
    from: &Account,
    to: &Account,
    amount: Uint128,
) -> StdResult<()> {
    from.subtract_balance(storage, amount)?;
    to.add_balance(storage, amount)
}

#[allow(clippy::too_many_arguments)]
pub fn send_impl(
    mut deps: DepsMut,
    sender: &Account,
    recipient: &Account,
    recipient_code_hash: Option<String>,
    amount: Uint128,
    memo: Option<String>,
    msg: Option<Binary>,
    block: &BlockInfo,
) -> StdResult<Vec<CosmosMsg>> {
    transfer_impl(
        deps.branch(),
        sender,
        recipient,
        amount,
        memo.clone(),
        block,
    )?;

    let sender_addr = deps.api.addr_humanize(sender.addr())?;

    add_receiver_api_callback(
        deps.as_ref(),
        recipient,
        recipient_code_hash,
        msg,
        sender_addr.clone(),
        sender_addr,
        amount,
        memo,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn add_receiver_api_callback(
    deps: Deps,
    recipient: &Account,
    recipient_code_hash: Option<String>,
    msg: Option<Binary>,
    sender: Addr,
    from: Addr,
    amount: Uint128,
    memo: Option<String>,
) -> StdResult<Vec<CosmosMsg>> {
    let recipient_addr = deps.api.addr_humanize(recipient.addr())?.to_string();
    if let Some(receiver_hash) = recipient_code_hash {
        let receiver_msg = Snip20ReceiveMsg::new(sender, from, amount, memo, msg);
        let callback_msg = receiver_msg.into_cosmos_msg(receiver_hash, recipient_addr)?;

        return Ok(vec![callback_msg]);
    }

    let receiver_hash = recipient.get_receiver_hash(deps.storage)?;
    if let Some(receiver_hash) = receiver_hash {
        let receiver_msg = Snip20ReceiveMsg::new(sender, from, amount, memo, msg);
        let callback_msg = receiver_msg.into_cosmos_msg(receiver_hash, recipient_addr)?;

        return Ok(vec![callback_msg]);
    }
    Ok(vec![])
}

pub fn transfer_from_impl(
    deps: DepsMut,
    env: &Env,
    spender: &CanonicalAddr,
    owner: &Account,
    recipient: &Account,
    amount: Uint128,
    memo: Option<String>,
) -> StdResult<()> {
    use_allowance(deps.storage, env, owner, spender, amount)?;
    perform_transfer(deps.storage, owner, recipient, amount)?;

    let symbol = Config::get_constants(deps.storage)?.symbol;

    store_transfer(
        deps.storage,
        owner.addr(),
        spender,
        recipient.addr(),
        amount,
        symbol,
        memo,
        &env.block,
    )?;

    Ok(())
}

pub fn use_allowance(
    storage: &mut dyn Storage,
    env: &Env,
    owner: &Account,
    spender: &CanonicalAddr,
    amount: Uint128,
) -> StdResult<Allowance> {
    fn insufficient_allowance(allowance: Uint128, required: Uint128) -> StdError {
        StdError::generic_err(format!(
            "insufficient allowance: allowance={}, required={}",
            allowance, required
        ))
    }

    owner.update_allowance(storage, spender, |allowance| {
        if allowance.is_expired_at(&env.block) {
            return Err(insufficient_allowance(Uint128::zero(), amount));
        }

        if let Ok(new_allowance) = allowance.amount.checked_sub(amount) {
            allowance.amount = new_allowance;
        } else {
            return Err(insufficient_allowance(allowance.amount, amount));
        }

        Ok(())
    })
}

#[allow(clippy::too_many_arguments)]
pub fn send_from_impl(
    mut deps: DepsMut,
    env: &Env,
    spender_canon: &CanonicalAddr,
    owner: &Account,
    recipient: &Account,
    recipient_code_hash: Option<String>,
    amount: Uint128,
    memo: Option<String>,
    msg: Option<Binary>,
) -> StdResult<Vec<CosmosMsg>> {
    transfer_from_impl(
        deps.branch(),
        &env,
        spender_canon,
        owner,
        recipient,
        amount,
        memo.clone(),
    )?;

    add_receiver_api_callback(
        deps.as_ref(),
        recipient,
        recipient_code_hash,
        msg,
        deps.api.addr_humanize(spender_canon)?,
        deps.api.addr_humanize(owner.addr())?,
        amount,
        memo,
    )
}

pub fn mint_impl(
    storage: &mut dyn Storage,
    minter: &CanonicalAddr,
    recipient: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    recipient.add_balance(storage, amount)?;

    store_mint(
        storage,
        minter,
        recipient.addr(),
        amount,
        denom,
        memo,
        block,
    )
}

pub fn check_if_admin(deps: Deps, account: &Addr) -> StdResult<()> {
    let admin = get_admin(deps)?;

    if admin != *account {
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

    Err(StdError::generic_err(format!(
        "Name is not in the expected format ({}-{} UTF-8 bytes)",
        range.start(),
        range.end()
    )))
}

pub fn assert_valid_symbol(symbol: &str, validation: SymbolValidation) -> StdResult<()> {
    let len_is_valid = validation.length.contains(&symbol.len());

    if len_is_valid {
        let mut cond = Vec::new();

        if validation.allow_upper {
            cond.push(b'A'..=b'Z');
        }

        if validation.allow_lower {
            cond.push(b'a'..=b'z');
        }

        if validation.allow_numeric {
            cond.push(b'0'..=b'9');
        }

        let special = validation.allowed_special.clone().unwrap_or_default();

        let valid = symbol
            .bytes()
            .all(|x| cond.iter().any(|c| c.contains(&x) || special.contains(&x)));

        if valid {
            return Ok(());
        }
    }

    return Err(StdError::generic_err(format!(
        "Token symbol is not in the expected format: {}",
        validation
    )));
}

#[derive(Clone)]
pub struct SymbolValidation {
    pub length: RangeInclusive<usize>,
    pub allow_upper: bool,
    pub allow_lower: bool,
    pub allow_numeric: bool,
    pub allowed_special: Option<Vec<u8>>,
}

impl fmt::Display for SymbolValidation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_fmt(format_args!(
            "{{{} - {}}}",
            self.length.start(),
            self.length.end()
        ))?;

        if self.allow_upper {
            f.write_str(" [A-Z]")?;
        }

        if self.allow_lower {
            f.write_str(" [a-z]")?;
        }

        if self.allow_numeric {
            f.write_str(" [0-9]")?;
        }

        if let Some(chars) = self.allowed_special.clone() {
            f.write_str(" [")?;

            for c in chars {
                f.write_char(c.into())?;
                f.write_char(',')?;
            }

            f.write_char(']')?;
        }

        Ok(())
    }
}

fn viewing_keys_queries(
    deps: Deps,
    env: Env,
    msg: QueryMsg,
    snip20: impl Snip20,
) -> StdResult<Binary> {
    let (addresses, key) = msg.get_validation_params();

    for address in addresses {
        let account = Account::of(deps.api.addr_canonicalize(address)?);
        let expected_key = account.get_viewing_key(deps.storage)?;

        if expected_key.is_none() {
            // Checking the key will take significant time. We don't want to exit immediately if it isn't set
            // in a way which will allow to time the command and determine if a viewing key doesn't exist
            key.check_viewing_key(&[0u8; VIEWING_KEY_SIZE]);
        } else if key.check_viewing_key(expected_key.unwrap().as_slice()) {
            return match msg {
                // Base
                QueryMsg::Balance { .. } => snip20.query_balance(deps, env, account),
                QueryMsg::TransferHistory {
                    page,
                    page_size,
                    ..
                } => snip20.query_transfers(deps, env, account, page.unwrap_or(0), page_size),
                QueryMsg::TransactionHistory {
                    page,
                    page_size,
                    ..
                } => snip20.query_transactions(deps, env, account, page.unwrap_or(0), page_size),
                QueryMsg::Allowance { owner, spender, .. } => {
                    let owner = deps.api.addr_canonicalize(&owner)?;
                    let spender = deps.api.addr_canonicalize(&spender)?;

                    snip20.query_allowance(deps, env, owner, spender)
                }
                _ => panic!("This query type does not require authentication"),
            };
        }
    }

    to_binary(&QueryAnswer::ViewingKeyError {
        msg: "Wrong viewing key for this address or viewing key not set".to_string(),
    })
}

fn permit_queries(
    deps: Deps,
    env: Env,
    snip20: impl Snip20,
    permit: Permit<QueryPermission>,
    query: QueryWithPermit,
) -> Result<Binary, StdError> {
    let validated_addr = permit.validate(deps, env.contract.address.clone().into(), None)?;
    let account = Account::of(deps.api.addr_canonicalize(validated_addr.as_str())?);

    match query {
        QueryWithPermit::Balance {} => {
            if !permit.check_permission(&QueryPermission::Balance) {
                return Err(StdError::generic_err(format!(
                    "No permission to query balance, got permissions {:?}",
                    permit.params.permissions
                )));
            }

            snip20.query_balance(deps, env, account)
        }
        QueryWithPermit::TransferHistory { page, page_size } => {
            if !permit.check_permission(&QueryPermission::History) {
                return Err(StdError::generic_err(format!(
                    "No permission to query history, got permissions {:?}",
                    permit.params.permissions
                )));
            }

            snip20.query_transfers(deps, env, account, page.unwrap_or(0), page_size)
        }
        QueryWithPermit::TransactionHistory { page, page_size } => {
            if !permit.check_permission(&QueryPermission::History) {
                return Err(StdError::generic_err(format!(
                    "No permission to query history, got permissions {:?}",
                    permit.params.permissions
                )));
            }

            snip20.query_transactions(deps, env, account, page.unwrap_or(0), page_size)
        }
        QueryWithPermit::Allowance { owner, spender } => {
            if !permit.check_permission(&QueryPermission::Allowance) {
                return Err(StdError::generic_err(format!(
                    "No permission to query allowance, got permissions {:?}",
                    permit.params.permissions
                )));
            }

            if validated_addr != owner && validated_addr != spender {
                return Err(StdError::generic_err(format!(
                    "Cannot query allowance. Requires permit for either owner {:?} or spender {:?}, got permit for {:?}",
                    owner.as_str(), spender.as_str(), validated_addr.as_str()
                )));
            }

            let owner = deps.api.addr_canonicalize(owner.as_str())?;
            let spender = deps.api.addr_canonicalize(spender.as_str())?;

            snip20.query_allowance(deps, env, owner, spender)
        }
    }
}

fn canonize_addresses(api: &dyn Api, addresses: Vec<String>) -> StdResult<Vec<CanonicalAddr>> {
    addresses
        .iter()
        .map(|addr| api.addr_canonicalize(addr.as_str()))
        .collect()
}

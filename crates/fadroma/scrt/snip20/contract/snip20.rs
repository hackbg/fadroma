use crate::{
    dsl::*,
    prelude::*,
    admin,
    crypto::sha_256,
    scrt::snip20::client::InstantiateMsg
};

use super::{
    state::{
        Account, Constants, TokenSettings, CONSTANTS,
        TOTAL_SUPPLY, MINTERS, PRNG_SEED, SUPPORTED_DENOMS
    },
    transaction_history::store_mint,
    TokenValidation
};

/// The instantiate entry point of the SNIP-20 contract.
/// [`super::DefaultImpl`] calls this with [`TokenValidation::default`].
pub fn instantiate(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
    validation: TokenValidation
) -> StdResult<Response> {
    // Check name, symbol, decimals
    if msg.decimals > 18 {
        return Err(StdError::generic_err("Token decimals may not exceed 18"));
    }

    validation.assert_is_valid(&msg.name, &msg.symbol)?;

    let token_config = msg.config.unwrap_or_default();
    let admin = admin::init(deps.branch(), msg.admin.as_deref(), &info)?;
    let admin = Account::of(admin);

    let mut total_supply = Uint128::zero();
    {
        let initial_balances = msg.initial_balances.unwrap_or_default();

        for balance in initial_balances {
            let account = Account::of(balance.address.as_str().canonize(deps.api)?);
            account.add_balance(deps.storage, balance.amount, None)?;

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
                &account,
                balance.amount,
                msg.symbol.clone(),
                Some("Initial Balance".to_string()),
                &env.block,
                None
            )?;
        }
    }

    TOTAL_SUPPLY.increase(deps.storage, total_supply)?;

    let minters = if token_config.enable_mint {
        Vec::from([admin.into()])
    } else {
        Vec::new()
    };
    MINTERS.save(deps.storage, &minters)?;

    let prng_seed_hashed = sha_256(&msg.prng_seed.0);
    PRNG_SEED.save(deps.storage, &prng_seed_hashed)?;

    CONSTANTS.save(
        deps.storage,
        &Constants {
            name: msg.name,
            symbol: msg.symbol,
            decimals: msg.decimals,
            token_settings: TokenSettings::from(token_config)
        }
    )?;

    SUPPORTED_DENOMS.save(
        deps.storage,
        &msg.supported_denoms.unwrap_or_default()
    )?;

    let messages = if let Some(callback) = msg.callback {
        vec![CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: callback.contract.address,
            code_hash: callback.contract.code_hash,
            msg: callback.msg,
            funds: vec![]
        })]
    } else {
        vec![]
    };

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("token_address", env.contract.address)
        .add_attribute("token_code_hash", env.contract.code_hash))
}

/// The default implementation of the SNIP-20 standard. It also implements an emergency killswitch.
/// If you simply want a SNIP-20 contract, just call [`default_impl::instantiate`], [`default_impl::execute`]
/// and [`default_impl::query`] in your contract.
/// 
/// If using the DSL you can use this with auto_impl to customize or extend the implementation.
#[contract]
pub(crate) mod default_impl {
    use crate::{
        self as fadroma,
        dsl::*,
        prelude::*,
        admin::{self, Admin, Mode},
        killswitch::{self, Killswitch, ContractStatus},
        scrt::{
            vk::auth::VkAuth,
            snip20::{
                client::{
                    InstantiateMsg as Snip20InstantiateMsg, ExecuteAnswer, QueryAnswer,
                    QueryPermission, QueryWithPermit, ResponseStatus,
                    MintAction, SendAction, BurnFromAction, SendFromAction, TransferFromAction,
                    TransferAction, TokenInfo, Snip20, InitialBalance, TokenConfig
                },
                contract::{
                    receiver::Snip20ReceiveMsg,
                    safe_math::safe_add,
                    state::{
                        Account, Allowance, TokenPermission, CONSTANTS,
                        TOTAL_SUPPLY, MINTERS, PRNG_SEED, SUPPORTED_DENOMS
                    },
                    transaction_history::{
                        store_burn, store_deposit, store_mint, store_redeem, store_transfer
                    },
                    decoy::{self, Decoys},
                    TokenValidation
                }
            },
            ResponseExt
        }
    };

    impl Contract {
        #[execute_guard]
        pub fn guard(msg: &ExecuteMsg) -> Result<(), StdError> {
            let status = killswitch::STORE.load_or_default(deps.storage)?;

            if !matches!(status, ContractStatus::Operational) {
                match msg {
                    ExecuteMsg::SetStatus { .. } => Ok(()),
                    ExecuteMsg::Redeem { .. } |
                    ExecuteMsg::ChangeAdmin { .. }
                        if matches!(status, ContractStatus::Paused { .. }) => Ok(()),
                    _ => Err(StdError::generic_err(
                        format!("{}", status.humanize(deps.api)?))
                    )
                }
            } else {
                Ok(())
            }
        }

        /// Checks if any of the provided accounts has the `provided_key`.
        /// Returns `Some` if none of them matched the key. This means that
        /// the authentication **failed**.
        pub fn authenticate(
            storage: &dyn Storage,
            accounts: &[&Account],
            provided_key: &ViewingKey
        ) -> StdResult<Option<QueryAnswer>> {
            for account in accounts {
                let expected_key = account.viewing_key(storage)?;

                if let Some(key) = expected_key {
                    if provided_key.check_hashed(&key) {
                        return Ok(None);
                    }
                }
            
                // Checking the key will take significant time. We don't want to exit immediately if it isn't set
                // in a way which will allow to time the command and determine if a viewing key doesn't exist.
                ViewingKeyHashed::default().check(&ViewingKeyHashed::default());
            }
        
            return Ok(Some(QueryAnswer::ViewingKeyError {
                msg: "Wrong viewing key for this address or viewing key not set".to_string(),
            }));
        }

        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_balance(storage: &dyn Storage, account: &Account) -> StdResult<QueryAnswer> {
            let amount = account.balance(storage)?;
    
            Ok(QueryAnswer::Balance { amount })
        }

        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_allowance(
            storage: &dyn Storage,
            owner: (&Account, String),
            spender: (&Account, String)
        ) -> StdResult<QueryAnswer> {
            let allowance = owner.0.allowance(storage, spender.0)?;
    
            Ok(QueryAnswer::Allowance {
                owner: Addr::unchecked(owner.1),
                spender: Addr::unchecked(spender.1),
                allowance: allowance.amount,
                expiration: allowance.expiration
            })
        }

        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_given_allowances(
            deps: Deps,
            owner: (&Account, String),
            page: Option<u32>,
            page_size: u32
        ) -> StdResult<QueryAnswer> {
            let (allowances, count) = owner.0.allowances(
                deps,
                page.unwrap_or(0),
                page_size
            )?;

            Ok(QueryAnswer::AllowancesGiven {
                owner: Addr::unchecked(owner.1),
                allowances,
                count
            })
        }

        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_received_allowances(
            deps: Deps,
            spender: (&Account, String),
            page: Option<u32>,
            page_size: u32
        ) -> StdResult<QueryAnswer> {
            let (allowances, count) = spender.0.received_allowances(
                deps,
                page.unwrap_or(0),
                page_size
            )?;

            Ok(QueryAnswer::AllowancesReceived {
                spender: Addr::unchecked(spender.1),
                allowances,
                count
            })
        }

        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_transfers(
            deps: Deps,
            account: &Account,
            page: Option<u32>,
            page_size: u32,
            filter_decoys: bool

        ) -> StdResult<QueryAnswer> {
            let (txs, total) = account.transfers(
                deps,
                page.unwrap_or(0),
                page_size,
                filter_decoys
            )?;
    
            Ok(QueryAnswer::TransferHistory {
                txs,
                total: Some(total),
            })
        }
        
        /// **This function does not perform authentication!**
        /// 
        /// Must be called after the address was verified via a viewing key or a permit.
        #[inline]
        pub fn query_transactions(
            deps: Deps,
            account: &Account,
            page: Option<u32>,
            page_size: u32,
            filter_decoys: bool
        ) -> StdResult<QueryAnswer> {
            let (txs, total) = account.txs(
                deps,
                page.unwrap_or(0),
                page_size,
                filter_decoys
            )?;
    
            Ok(QueryAnswer::TransactionHistory {
                txs,
                total: Some(total),
            })
        }
    }

    impl Snip20 for Contract {
        type Error = StdError;

        #[inline]
        #[init(entry)]
        fn new(
            name: String,
            admin: Option<String>,
            symbol: String,
            decimals: u8,
            initial_balances: Option<Vec<InitialBalance>>,
            prng_seed: Binary,
            config: Option<TokenConfig>,
            supported_denoms: Option<Vec<String>>,
            callback: Option<Callback<String>>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let msg = Snip20InstantiateMsg {
                name,
                admin,
                symbol,
                decimals,
                initial_balances,
                prng_seed,
                config,
                supported_denoms,
                callback
            };

            super::instantiate(deps, env, info, msg, TokenValidation::default())
        }
    
        #[execute]
        fn deposit(
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let settings = CONSTANTS.load_or_error(deps.storage)?.token_settings;
            if !settings.is_set(TokenPermission::Deposit) {
                return Err(StdError::generic_err(
                    "Deposit functionality is not enabled for this token.",
                ));
            }

            let account = Account::of(info.sender.canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };

            let supported = SUPPORTED_DENOMS.load_or_default(deps.storage)?;
            let mut amount = Uint128::zero();

            for coin in info.funds {
                if supported.contains(&coin.denom) {
                    amount += coin.amount;

                    if !coin.amount.is_zero() {
                        store_deposit(
                            deps.storage,
                            &account,
                            coin.amount,
                            coin.denom,
                            &env.block,
                            decoys.as_ref()
                        )?;
                    }
                } else {
                    return Err(StdError::generic_err(format!(
                        "Tried to deposit an unsupported token: {}.",
                        coin.denom
                    )));
                }
            }
    
            if amount.is_zero() {
                return Err(StdError::generic_err("No funds were sent to be deposited."));
            }
    
            let amount = TOTAL_SUPPLY.increase(deps.storage, amount)?;    
            account.add_balance(deps.storage, amount, decoys.as_ref())?;
            
            ExecuteAnswer::Deposit {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn redeem(
            amount: Uint128,
            denom: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Redeem) {
                return Err(StdError::generic_err(
                    "Redeem functionality is not enabled for this token.",
                ));
            }

            if amount.is_zero() {
                return Err(StdError::generic_err("Redeem amount cannot be 0."));
            }

            let mut supported = SUPPORTED_DENOMS.load_or_default(deps.storage)?;
            let denom = match denom {
                Some(denom) if supported.contains(&denom) => denom,
                None if supported.len() == 1 => supported.pop().unwrap(),
                None if supported.len() > 1 => return Err(StdError::generic_err(
                    "Tried to redeem without specifying denom, but multiple coins are supported.",
                )),
                _ => return Err(StdError::generic_err(
                    "Tried to redeem an unsupported coin.",
                ))
            };

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            let account = Account::of(info.sender.as_str().canonize(deps.api)?);
            account.subtract_balance(deps.storage, amount, decoys.as_ref())?;
    
            TOTAL_SUPPLY.decrease(deps.storage, amount)?;
    
            let token_reserve = deps
                .querier
                .query_balance(env.contract.address, &denom)?
                .amount;
            
            if amount > token_reserve {
                return Err(StdError::generic_err(format!(
                    "You are trying to redeem more {} than the token has in its reserve.",
                    denom
                )));
            }
    
            store_redeem(
                deps.storage,
                &account,
                amount,
                denom.clone(),
                &env.block,
                decoys.as_ref()
            )?;

            let resp = Response::new().add_message(
                CosmosMsg::Bank(BankMsg::Send {
                    to_address: info.sender.into_string(),
                    amount: vec![Coin {
                        denom,
                        amount
                    }]
                })
            );

            ExecuteAnswer::Redeem {
                status: ResponseStatus::Success
            }.with_resp(resp)
        }
    
        #[execute]
        fn transfer(
            recipient: String,
            amount: Uint128,
            memo: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let sender = Account::of(info.sender.canonize(deps.api)?);
            let recipient = Account::of(recipient.as_str().canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            transfer_impl(
                deps,
                &sender,
                &recipient,
                amount,
                memo,
                &env.block,
                decoys.as_ref()
            )?;
    
            ExecuteAnswer::Transfer {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn send(
            recipient: String,
            recipient_code_hash: Option<String>,
            amount: Uint128,
            memo: Option<String>,
            msg: Option<Binary>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let sender = Account::of(info.sender.canonize(deps.api)?);
            let recipient = Account::of(recipient.as_str().canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            let messages = send_impl(
                deps,
                &sender,
                &recipient,
                recipient_code_hash,
                amount,
                memo,
                msg,
                &env.block,
                decoys.as_ref()
            )?;
    
            ExecuteAnswer::Send {
                status: ResponseStatus::Success
            }.with_resp(Response::new().add_messages(messages))
        }
    
        #[execute]
        fn burn(
            amount: Uint128,
            memo: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Burn) {
                return Err(StdError::generic_err(
                    "Burn functionality is not enabled for this token.",
                ));
            }

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            let account = Account::of(info.sender.canonize(deps.api)?);
            account.subtract_balance(deps.storage, amount, decoys.as_ref())?;
    
            TOTAL_SUPPLY.decrease(deps.storage, amount)?;
    
            store_burn(
                deps.storage,
                &account,
                &account,
                amount,
                constants.symbol,
                memo,
                &env.block,
                decoys.as_ref()
            )?;

            ExecuteAnswer::Burn {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn register_receive(
            code_hash: String,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            Account::of(info.sender.canonize(deps.api)?)
                .set_receiver_hash(deps.storage, code_hash)?;

            ExecuteAnswer::RegisterReceive {
                status: ResponseStatus::Success
            }.with_resp(Response::new()
                .add_attribute("register_status", "success")
            )
        }
    
        #[execute]
        fn increase_allowance(
            spender: String,
            amount: Uint128,
            expiration: Option<u64>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let account = Account::of(info.sender.as_str().canonize(deps.api)?);
            let spender_acc = Account::of(spender.as_str().canonize(deps.api)?);
    
            let new_allowance = account.update_allowance(
                deps.storage,
                &spender_acc,
                |mut allowance| {
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
    
                    Ok(allowance)
                }
            )?;
    
            ExecuteAnswer::IncreaseAllowance {
                owner: info.sender,
                spender: Addr::unchecked(spender),
                allowance: new_allowance.amount
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn decrease_allowance(
            spender: String,
            amount: Uint128,
            expiration: Option<u64>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let account = Account::of(info.sender.as_str().canonize(deps.api)?);
            let spender_acc = Account::of(spender.as_str().canonize(deps.api)?);
    
            let new_allowance = account.update_allowance(
                deps.storage,
                &spender_acc,
                |mut allowance| {
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
    
                    Ok(allowance)
                }
            )?;
            
            ExecuteAnswer::DecreaseAllowance {
                owner: info.sender,
                spender: Addr::unchecked(spender),
                allowance: new_allowance.amount,
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn transfer_from(
            owner: String,
            recipient: String,
            amount: Uint128,
            memo: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let spender = Account::of(info.sender.canonize(deps.api)?);
            let owner = Account::of(owner.as_str().canonize(deps.api)?);
            let recipient = Account::of(recipient.as_str().canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            transfer_from_impl(
                deps,
                &env,
                &spender,
                &owner,
                &recipient,
                amount,
                memo,
                decoys.as_ref()
            )?;
    
            ExecuteAnswer::TransferFrom {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn send_from(
            owner: String,
            recipient: String,
            recipient_code_hash: Option<String>,
            amount: Uint128,
            memo: Option<String>,
            msg: Option<Binary>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let spender = Account::of(info.sender.canonize(deps.api)?);
            let owner = Account::of(owner.as_str().canonize(deps.api)?);
            let recipient = Account::of(recipient.as_str().canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
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
                decoys.as_ref()
            )?;

            ExecuteAnswer::SendFrom {
                status: ResponseStatus::Success,
            }.with_resp(
                Response::new().add_messages(messages)
            )
        }
    
        #[execute]
        fn burn_from(
            owner: String,
            amount: Uint128,
            memo: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Burn) {
                return Err(StdError::generic_err(
                    "Burn functionality is not enabled for this token.",
                ));
            }

            let owner = Account::of(owner.as_str().canonize(deps.api)?);
            let spender = Account::of(info.sender.canonize(deps.api)?);

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            use_allowance(deps.storage, &env, &owner, &spender, amount)?;
    
            owner.subtract_balance(deps.storage, amount, decoys.as_ref())?;
    
            TOTAL_SUPPLY.decrease(deps.storage, amount)?;
    
            store_burn(
                deps.storage,
                &owner,
                &spender,
                amount,
                constants.symbol,
                memo,
                &env.block,
                decoys.as_ref()
            )?;

            ExecuteAnswer::BurnFrom {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn mint(
            recipient: String,
            amount: Uint128,
            memo: Option<String>,
            decoys: Option<Vec<String>>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Mint) {
                return Err(StdError::generic_err(
                    "Mint functionality is not enabled for this token.",
                ));
            }
    
            let minters = MINTERS.load_humanize_or_default(deps.as_ref())?;
            if !minters.contains(&info.sender) {
                return Err(StdError::generic_err(
                    "Minting is allowed to minter accounts only",
                ));
            }

            let decoys = if let Some(decoys) = decoys {
                Decoys::new(deps.branch(), &decoys, entropy.and_then(|x| Some(x.0)))?
            } else {
                None
            };
    
            let amount = TOTAL_SUPPLY.increase(deps.storage, amount)?;
    
            let minter = Account::of(info.sender.canonize(deps.api)?);
            let recipient = Account::of(recipient.as_str().canonize(deps.api)?);
    
            mint_impl(
                deps.storage,
                &minter,
                &recipient,
                amount,
                constants.symbol,
                memo,
                &env.block,
                decoys.as_ref()
            )?;

            ExecuteAnswer::Mint {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        #[admin::require_admin]
        fn add_minters(
            minters: Vec<String>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Mint) {
                return Err(StdError::generic_err(
                    "Mint functionality is not enabled for this token.",
                ));
            }
    
            let canonized_minters = minters.as_slice().canonize(deps.api)?;
            MINTERS.add(deps.storage, canonized_minters)?;
    
            ExecuteAnswer::AddMinters {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        #[admin::require_admin]
        fn remove_minters(
            minters: Vec<String>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Mint) {
                return Err(StdError::generic_err(
                    "Mint functionality is not enabled for this token.",
                ));
            }
    
            let canonized_minters = minters.as_slice().canonize(deps.api)?;
            MINTERS.remove_minters(deps.storage, canonized_minters)?;
    
            ExecuteAnswer::RemoveMinters {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        #[admin::require_admin]
        fn set_minters(
            minters: Vec<String>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Mint) {
                return Err(StdError::generic_err(
                    "Mint functionality is not enabled for this token.",
                ));
            }
    
            let canonized_minters = minters.as_slice().canonize(deps.api)?;
            MINTERS.save(deps.storage, &canonized_minters)?;

            ExecuteAnswer::SetMinters {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }

        #[execute]
        #[admin::require_admin]
        fn add_supported_denoms(
            denoms: Vec<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::ModifyDenoms) {
                return Err(StdError::generic_err(
                    "Cannot modify denoms for this token.",
                ));
            }

            let mut supported = SUPPORTED_DENOMS.load_or_default(deps.storage)?;
            supported.reserve(denoms.len());

            for denom in denoms {
                if !supported.contains(&denom) {
                    supported.push(denom);
                }
            }

            SUPPORTED_DENOMS.save(deps.storage, &supported)?;

            ExecuteAnswer::AddSupportedDenoms {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        #[admin::require_admin]
        fn remove_supported_denoms(
            denoms: Vec<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::ModifyDenoms) {
                return Err(StdError::generic_err(
                    "Cannot modify denoms for this token.",
                ));
            }

            let mut supported = SUPPORTED_DENOMS.load_or_default(deps.storage)?;

            for denom in denoms {
                if let Some(index) = supported.iter()
                    .position(|x| x == &denom)
                {
                    supported.swap_remove(index);
                }
            }

            SUPPORTED_DENOMS.save(deps.storage, &supported)?;

            ExecuteAnswer::RemoveSupportedDenoms {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn batch_transfer(
            actions: Vec<TransferAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let sender = Account::of(info.sender.canonize(deps.api)?);
            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;

            for action in actions {
                let recipient = Account::of(action.recipient.as_str().canonize(deps.api)?);
                let decoys = if let Some(decoys) = action.decoys {
                    builder.create(deps.api, &decoys)?
                } else {
                    None
                };
    
                transfer_impl(
                    deps.branch(),
                    &sender,
                    &recipient,
                    action.amount,
                    action.memo,
                    &env.block,
                    decoys.as_ref()
                )?;
            }
    
            ExecuteAnswer::BatchTransfer {
                status: ResponseStatus::Success,
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn batch_send(
            actions: Vec<SendAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let mut messages = Vec::with_capacity(actions.len());
            let sender = Account::of(info.sender.canonize(deps.api)?);

            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;
    
            for action in actions {
                let recipient = Account::of(action.recipient.as_str().canonize(deps.api)?);
                let decoys = if let Some(decoys) = action.decoys {
                    builder.create(deps.api, &decoys)?
                } else {
                    None
                };
    
                let msgs = send_impl(
                    deps.branch(),
                    &sender,
                    &recipient,
                    None,
                    action.amount,
                    action.memo,
                    action.msg,
                    &env.block,
                    decoys.as_ref()
                )?;
    
                messages.extend(msgs);
            }

            ExecuteAnswer::BatchSend {
                status: ResponseStatus::Success
            }.with_resp(
                Response::new().add_messages(messages)
            )
        }
    
        #[execute]
        fn batch_transfer_from(
            actions: Vec<TransferFromAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let spender = Account::of(info.sender.canonize(deps.api)?);
            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;

            for action in actions {
                let owner = Account::of(action.owner.as_str().canonize(deps.api)?);
                let recipient = Account::of(action.recipient.as_str().canonize(deps.api)?);

                let decoys = if let Some(decoys) = action.decoys {
                    builder.create(deps.api, &decoys)?
                } else {
                    None
                };
    
                transfer_from_impl(
                    deps.branch(),
                    &env,
                    &spender,
                    &owner,
                    &recipient,
                    action.amount,
                    action.memo,
                    decoys.as_ref()
                )?;
            }
    
            ExecuteAnswer::BatchTransferFrom {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn batch_send_from(
            actions: Vec<SendFromAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let mut messages = Vec::with_capacity(actions.len());
            let spender = Account::of(info.sender.canonize(deps.api)?);

            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;
    
            for action in actions {
                let owner = Account::of(action.owner.as_str().canonize(deps.api)?);
                let recipient = Account::of(action.recipient.as_str().canonize(deps.api)?);

                let decoys = if let Some(decoys) = action.decoys {
                    builder.create(deps.api, &decoys)?
                } else {
                    None
                };
    
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
                    decoys.as_ref()
                )?;
    
                messages.extend(msgs);
            }

            ExecuteAnswer::BatchSendFrom {
                status: ResponseStatus::Success,
            }.with_resp(
                Response::new().add_messages(messages)
            )
        }
    
        #[execute]
        fn batch_burn_from(
            actions: Vec<BurnFromAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Burn) {
                return Err(StdError::generic_err(
                    "Burn functionality is not enabled for this token.",
                ));
            }
    
            let spender = Account::of(info.sender.canonize(deps.api)?);
            let mut total_supply = TOTAL_SUPPLY.load_or_default(deps.storage)?;

            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;
    
            for action in actions {
                let owner = Account::of(action.owner.as_str().canonize(deps.api)?);
                let decoys = if let Some(decoys) = &action.decoys {
                    builder.create(deps.api, decoys)?
                } else {
                    None
                };
    
                use_allowance(deps.storage, &env, &owner, &spender, action.amount)?;
                owner.subtract_balance(deps.storage, action.amount, decoys.as_ref())?;
    
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
                    &owner,
                    &spender,
                    action.amount,
                    constants.symbol.clone(),
                    action.memo,
                    &env.block,
                    decoys.as_ref()
                )?;
            }
    
            TOTAL_SUPPLY.save(deps.storage, &total_supply)?;
    
            ExecuteAnswer::BatchBurnFrom {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn batch_mint(
            actions: Vec<MintAction>,
            entropy: Option<Binary>,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            if !constants.token_settings.is_set(TokenPermission::Mint) {
                return Err(StdError::generic_err(
                    "Mint functionality is not enabled for this token.",
                ));
            }
    
            let minters = MINTERS.load_humanize_or_default(deps.as_ref())?;
            if !minters.contains(&info.sender) {
                return Err(StdError::generic_err(
                    "Minting is allowed for minter accounts only!",
                ));
            }

            let builder = decoy::Builder::new(
                deps.storage,
                entropy.and_then(|x| Some(x.0))
            )?;
    
            let mut total_supply = TOTAL_SUPPLY.load_or_default(deps.storage)?;
            let minter = Account::of(info.sender.canonize(deps.api)?);
    
            for action in actions {
                let recipient = Account::of(action.recipient.as_str().canonize(deps.api)?);
                let mint_amount = safe_add(&mut total_supply, action.amount);

                let decoys = if let Some(decoys) = action.decoys {
                    builder.create(deps.api, &decoys)?
                } else {
                    None
                };
    
                mint_impl(
                    deps.storage,
                    &minter,
                    &recipient,
                    mint_amount,
                    constants.symbol.clone(),
                    action.memo,
                    &env.block,
                    decoys.as_ref()
                )?;
            }

            TOTAL_SUPPLY.save(deps.storage, &total_supply)?;
    
            ExecuteAnswer::BatchMint {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[execute]
        fn revoke_permit(
            permit_name: String,
            _padding: Option<String>
        ) -> Result<Response, <Self as Snip20>::Error> {
            Permit::<QueryPermission>::revoke(deps.storage, &info.sender, &permit_name);

            ExecuteAnswer::RevokePemit {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    
        #[query]
        fn exchange_rate() -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;

            if constants.token_settings.is_set(TokenPermission::Deposit) ||
                constants.token_settings.is_set(TokenPermission::Redeem) {
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
                return Ok(QueryAnswer::ExchangeRate { rate, denom });
            }

            Ok(QueryAnswer::ExchangeRate {
                rate: Uint128::new(0),
                denom: String::new(),
            })
        }
    
        #[query]
        fn token_info() -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let constants = CONSTANTS.load_or_error(deps.storage)?;
            let total_supply = if constants.token_settings.is_set(
                TokenPermission::PublicTotalSupply
            ) {
                Some(TOTAL_SUPPLY.load_or_default(deps.storage)?)
            } else {
                None
            };
    
            Ok(QueryAnswer::TokenInfo(TokenInfo {
                name: constants.name,
                symbol: constants.symbol,
                decimals: constants.decimals,
                total_supply,
            }))
        }

        #[query]
        fn token_config() -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let s = CONSTANTS.load_or_error(deps.storage)?.token_settings;

            Ok(QueryAnswer::TokenConfig {
                public_total_supply: s.is_set(TokenPermission::PublicTotalSupply),
                deposit_enabled: s.is_set(TokenPermission::Deposit),
                redeem_enabled: s.is_set(TokenPermission::Redeem),
                mint_enabled: s.is_set(TokenPermission::Mint),
                burn_enabled: s.is_set(TokenPermission::Burn),
                supported_denoms: SUPPORTED_DENOMS.load_or_default(deps.storage)?
            })
        }
    
        #[query]
        fn minters() -> Result<QueryAnswer, <Self as Snip20>::Error> {
            Ok(QueryAnswer::Minters {
                minters: MINTERS.load_humanize_or_default(deps)?
            })
        }
    
        #[query]
        fn allowance(
            owner: String,
            spender: String,
            key: String
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let owner_acc = Account::of(owner.as_str().canonize(deps.api)?);
            let spender_acc = Account::of(spender.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&owner_acc, &spender_acc],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_allowance(
                    deps.storage,
                    (&owner_acc, owner),
                    (&spender_acc, spender)
                )
            }
        }
    
        #[query]
        fn balance(
            address: String,
            key: String
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let account = Account::of(address.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&account],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_balance(
                    deps.storage,
                    &account
                )
            }
        }
    
        #[query]
        fn transfer_history(
            address: String,
            key: String,
            page: Option<u32>,
            page_size: u32,
            should_filter_decoys: bool
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let account = Account::of(address.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&account],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_transfers(
                    deps,
                    &account,
                    page,
                    page_size,
                    should_filter_decoys
                )
            }
        }
    
        #[query]
        fn transaction_history(
            address: String,
            key: String,
            page: Option<u32>,
            page_size: u32,
            should_filter_decoys: bool
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let account = Account::of(address.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&account],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_transactions(
                    deps,
                    &account,
                    page,
                    page_size,
                    should_filter_decoys
                )
            }
        }

        #[query]
        fn allowances_given(
            owner: String,
            key: String,
            page: Option<u32>,
            page_size: u32
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let account = Account::of(owner.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&account],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_given_allowances(
                    deps,
                    (&account, owner),
                    page,
                    page_size
                )
            }
        }
    
        #[query]
        fn allowances_received(
            spender: String,
            key: String,
            page: Option<u32>,
            page_size: u32
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let account = Account::of(spender.as_str().canonize(deps.api)?);

            if let Some(err) = Self::authenticate(
                deps.storage,
                &[&account],
                &ViewingKey(key)
            )? {
                Ok(err)
            } else {
                Self::query_received_allowances(
                    deps,
                    (&account, spender),
                    page,
                    page_size
                )
            }
        }
    
        #[query]
        fn with_permit(
            permit: crate::scrt::permit::Permit<QueryPermission>,
            query: QueryWithPermit
        ) -> Result<QueryAnswer, <Self as Snip20>::Error> {
            let validated_addr = permit.validate(deps, env.contract.address.as_str(), None, &[])?;
        
            match query {
                QueryWithPermit::Balance {} => {
                    if !permit.has_permission(&QueryPermission::Balance) {
                        return Err(StdError::generic_err(format!(
                            "No permission to query balance, got permissions {:?}",
                            permit.params.permissions
                        )));
                    }

                    let account = Account::of(validated_addr.as_str().canonize(deps.api)?);
        
                    Self::query_balance(deps.storage, &account)
                }
                QueryWithPermit::TransferHistory { page, page_size, should_filter_decoys } => {
                    if !permit.has_permission(&QueryPermission::History) {
                        return Err(StdError::generic_err(format!(
                            "No permission to query history, got permissions {:?}",
                            permit.params.permissions
                        )));
                    }
                    
                    let account = Account::of(validated_addr.as_str().canonize(deps.api)?);
        
                    Self::query_transfers(
                        deps,
                        &account,
                        page,
                        page_size,
                        should_filter_decoys
                    )
                }
                QueryWithPermit::TransactionHistory { page, page_size, should_filter_decoys } => {
                    if !permit.has_permission(&QueryPermission::History) {
                        return Err(StdError::generic_err(format!(
                            "No permission to query history, got permissions {:?}",
                            permit.params.permissions
                        )));
                    }
                    
                    let account = Account::of(validated_addr.as_str().canonize(deps.api)?);
        
                    Self::query_transactions(
                        deps,
                        &account,
                        page,
                        page_size,
                        should_filter_decoys
                    )
                }
                QueryWithPermit::Allowance { owner, spender } => {
                    if !permit.has_permission(&QueryPermission::Allowance) {
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
        
                    let owner_acc = Account::of(owner.as_str().canonize(deps.api)?);
                    let spender_acc = Account::of(spender.as_str().canonize(deps.api)?);
        
                    Self::query_allowance(
                        deps.storage,
                        (&owner_acc, owner),
                        (&spender_acc, spender)
                    )
                }
                QueryWithPermit::AllowancesGiven { owner, page, page_size } => {
                    if validated_addr != owner {
                        return Err(StdError::generic_err(
                            "Permit signer must match the \"owner\" parameter.",
                        ));
                    }

                    if !permit.has_permission(&QueryPermission::Allowance) &&
                        !permit.has_permission(&QueryPermission::Owner) {
                        return Err(StdError::generic_err(format!(
                            "No permission to query given allowances, got permissions {:?}",
                            permit.params.permissions
                        )));
                    }

                    let account = Account::of(validated_addr.as_str().canonize(deps.api)?);

                    Self::query_given_allowances(
                        deps,
                        (&account, validated_addr),
                        page,
                        page_size
                    )
                }
                QueryWithPermit::AllowancesReceived { spender, page, page_size } => {
                    if validated_addr != spender {
                        return Err(StdError::generic_err(
                            "Permit signer must match the \"spender\" parameter.",
                        ));
                    }

                    if !permit.has_permission(&QueryPermission::Allowance) &&
                        !permit.has_permission(&QueryPermission::Owner) {
                        return Err(StdError::generic_err(format!(
                            "No permission to query received allowances, got permissions {:?}",
                            permit.params.permissions
                        )));
                    }

                    let account = Account::of(validated_addr.as_str().canonize(deps.api)?);

                    Self::query_received_allowances(
                        deps,
                        (&account, validated_addr),
                        page,
                        page_size
                    )
                }
            }
        }
    }

    #[auto_impl(killswitch::DefaultImpl)]
    impl Killswitch for Contract {
        #[execute]
        fn set_status(
            status: ContractStatus<Addr>,
        ) -> Result<Response, <Self as Killswitch>::Error> {
            // This checks if the calling address is the current admin.
            let resp = killswitch::DefaultImpl::set_status(deps, env, info, status)?;

            let data = to_binary(&ExecuteAnswer::SetStatus {
                status: ResponseStatus::Success,
            })?;

            Ok(resp.set_data(data).pad())
        }
    
        #[query]
        fn status() -> Result<ContractStatus<Addr>, <Self as Killswitch>::Error> { }
    }

    #[auto_impl(admin::DefaultImpl)]
    impl Admin for Contract {
        #[execute]
        fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error> {
            // This checks if the calling address is the current admin.
            let resp = admin::DefaultImpl::change_admin(deps, env, info, mode)?;

            let data = to_binary(&ExecuteAnswer::ChangeAdmin {
                status: ResponseStatus::Success
            })?;

            Ok(resp.set_data(data).pad())
        }
    
        #[query]
        fn admin() -> Result<Option<Addr>, Self::Error> { }
    }

    impl VkAuth for Contract {
        type Error = StdError;

        #[execute]
        fn create_viewing_key(entropy: String, _padding: Option<String>) -> Result<Response, Self::Error> {
            let prng_seed = PRNG_SEED.load_or_error(deps.storage)?;
            let key = ViewingKey::new(
                &env,
                &info,
                &prng_seed,
                entropy.as_bytes()
            );
    
            Account::of(info.sender.canonize(deps.api)?)
                .set_viewing_key(deps.storage, &key)?;
    
            ExecuteAnswer::CreateViewingKey { key }
                .with_resp(Response::new())
        }
    
        #[execute]
        fn set_viewing_key(key: String, _padding: Option<String>) -> Result<Response, Self::Error> {
            Account::of(info.sender.canonize(deps.api)?)
                .set_viewing_key(deps.storage, &ViewingKey(key))?;

            ExecuteAnswer::SetViewingKey {
                status: ResponseStatus::Success
            }.with_resp(Response::new())
        }
    }

    #[inline]
    pub fn transfer_impl(
        deps: DepsMut,
        sender: &Account,
        recipient: &Account,
        amount: Uint128,
        memo: Option<String>,
        block: &BlockInfo,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        perform_transfer(deps.storage, sender, recipient, amount, decoys)?;
        let symbol = CONSTANTS.load_or_error(deps.storage)?.symbol;

        store_transfer(
            deps.storage,
            sender,
            sender,
            recipient,
            amount,
            symbol,
            memo,
            block,
            decoys
        )
    }

    #[inline]
    pub fn perform_transfer(
        storage: &mut dyn Storage,
        from: &Account,
        to: &Account,
        amount: Uint128,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        from.subtract_balance(storage, amount, None)?;
        to.add_balance(storage, amount, decoys)
    }

    #[inline]
    pub fn send_impl(
        mut deps: DepsMut,
        sender: &Account,
        recipient: &Account,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
        block: &BlockInfo,
        decoys: Option<&Decoys>
    ) -> StdResult<Vec<CosmosMsg>> {
        transfer_impl(
            deps.branch(),
            sender,
            recipient,
            amount,
            memo.clone(),
            block,
            decoys
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
            memo
        )
    }

    #[inline]
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

        let receiver_hash = recipient.receiver_hash(deps.storage)?;
        if let Some(receiver_hash) = receiver_hash {
            let receiver_msg = Snip20ReceiveMsg::new(sender, from, amount, memo, msg);
            let callback_msg = receiver_msg.into_cosmos_msg(receiver_hash, recipient_addr)?;

            return Ok(vec![callback_msg]);
        }

        Ok(vec![])
    }

    #[inline]
    pub fn transfer_from_impl(
        deps: DepsMut,
        env: &Env,
        spender: &Account,
        owner: &Account,
        recipient: &Account,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        use_allowance(deps.storage, env, owner, spender, amount)?;
        perform_transfer(deps.storage, owner, recipient, amount, decoys)?;

        let symbol = CONSTANTS.load_or_error(deps.storage)?.symbol;

        store_transfer(
            deps.storage,
            owner,
            spender,
            recipient,
            amount,
            symbol,
            memo,
            &env.block,
            decoys
        )?;

        Ok(())
    }

    #[inline]
    pub fn use_allowance(
        storage: &mut dyn Storage,
        env: &Env,
        owner: &Account,
        spender: &Account,
        amount: Uint128,
    ) -> StdResult<Allowance> {
        fn insufficient_allowance(allowance: Uint128, required: Uint128) -> StdError {
            StdError::generic_err(format!(
                "insufficient allowance: allowance={}, required={}",
                allowance, required
            ))
        }

        owner.update_allowance(storage, spender, |mut allowance| {
            if allowance.is_expired_at(&env.block) {
                return Err(insufficient_allowance(Uint128::zero(), amount));
            }

            if let Ok(new_allowance) = allowance.amount.checked_sub(amount) {
                allowance.amount = new_allowance;
            } else {
                return Err(insufficient_allowance(allowance.amount, amount));
            }

            Ok(allowance)
        })
    }

    #[inline]
    pub fn send_from_impl(
        mut deps: DepsMut,
        env: &Env,
        spender: &Account,
        owner: &Account,
        recipient: &Account,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
        decoys: Option<&Decoys>
    ) -> StdResult<Vec<CosmosMsg>> {
        transfer_from_impl(
            deps.branch(),
            &env,
            spender,
            owner,
            recipient,
            amount,
            memo.clone(),
            decoys
        )?;

        add_receiver_api_callback(
            deps.as_ref(),
            recipient,
            recipient_code_hash,
            msg,
            deps.api.addr_humanize(spender.addr())?,
            deps.api.addr_humanize(owner.addr())?,
            amount,
            memo
        )
    }

    #[inline]
    pub fn mint_impl(
        storage: &mut dyn Storage,
        minter: &Account,
        recipient: &Account,
        amount: Uint128,
        denom: String,
        memo: Option<String>,
        block: &BlockInfo,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        recipient.add_balance(storage, amount, decoys)?;

        store_mint(
            storage,
            minter,
            recipient,
            amount,
            denom,
            memo,
            block,
            decoys
        )
    }
}

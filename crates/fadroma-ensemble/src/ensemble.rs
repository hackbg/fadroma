use std::{
    fmt::Debug,
    convert::TryFrom
};
use serde::{
    Serialize,
    de::DeserializeOwned
};
use fadroma::{
    prelude::{ContractCode, ContractLink},
    cosmwasm_std::{
        SubMsg, Deps, DepsMut, Env, Response, MessageInfo, Binary, Coin, Empty,
        CosmosMsg, WasmMsg, BlockInfo, ContractInfo, BankMsg, Timestamp, Addr,
        SubMsgResponse, SubMsgResult, Reply, Storage, Api, Querier, QuerierWrapper,
        from_binary, to_binary, testing::MockApi
    }
};

use oorandom::Rand64;

#[cfg(feature = "ensemble-staking")]
use fadroma::cosmwasm_std::{
    Uint128, FullDelegation, Validator, Delegation, StakingMsg, DistributionMsg
};

use super::{
    bank::Balances,
    block::Block,
    env::MockEnv,
    querier::EnsembleQuerier,
    response::{
        ResponseVariants, ExecuteResponse,
        InstantiateResponse, ReplyResponse
    },
    state::State,
    execution_state::{ExecutionState, MessageType},
    error::{EnsembleError, RegistryError},
    event::ProcessedEvents
};

#[cfg(feature = "ensemble-staking")]
use super::staking::Delegations;

pub type AnyResult<T> = anyhow::Result<T>;
pub type EnsembleResult<T> = core::result::Result<T, EnsembleError>;

pub(crate) type SubMsgExecuteResult = EnsembleResult<(ResponseVariants, ProcessedEvents)>;

/// The trait that allows the ensemble to execute your contract. Must be implemented
/// for each contract that will participate in the shared execution. Usually implemented
/// by calling the respective contract function for each method of the trait by passing
/// down the parameters of the method and calling `cosmwasm_std::from_binary()` on the 
/// `msg` parameter. It can also be used to implement a mock contract directly.
pub trait ContractHarness {
    fn instantiate(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn query(&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary>;

    fn reply(&self, _deps: DepsMut, _env: Env, _reply: Reply) -> AnyResult<Response> {
        panic!("Reply entry point not implemented.")
    }
}

/// This the main type in the system that takes care of registering and executing contracts,
/// keeping the blockchain simulation state and allowing the manipulation of particular parameters
/// such as account funds, blocks or contract state in order to efficiently simulate testing scenarios.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::{
///     cosmwasm_std::{Deps, DepsMut, Env, MessageInfo, Response, Binary, from_binary, to_binary},
///     storage::{load, save},
///     serde::{Serialize, Deserialize},
///     schemars::{self, JsonSchema}
/// };
/// use fadroma_ensemble::{
///     ContractEnsemble, ContractHarness, MockEnv, EnsembleResult, AnyResult
/// };
/// 
/// const NUMBER_KEY: &[u8] = b"number";
/// 
/// struct Counter;
/// 
/// #[derive(Serialize, Deserialize, schemars::JsonSchema)]
/// #[serde(rename_all = "snake_case")]
/// enum ExecuteMsg {
///     Increment,
///     Reset
/// }
/// 
/// impl ContractHarness for Counter {
///     fn instantiate(&self, deps: DepsMut, env: Env, info: MessageInfo, _msg: Binary) -> AnyResult<Response> {
///         Ok(Response::default())
///     }
///
///     fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response> {
///         match from_binary(&msg)? {
///             ExecuteMsg::Increment => {
///                 let mut number: u64 = load(deps.storage, NUMBER_KEY)?.unwrap_or_default();
///                 number += 1;
/// 
///                 save(deps.storage, NUMBER_KEY, &number)?;
///             },
///             ExecuteMsg::Reset => save(deps.storage, NUMBER_KEY, &0u64)?
///         };
///  
///         Ok(Response::default())
///     }
///
///     fn query(&self, deps: Deps, env: Env, _msg: Binary) -> AnyResult<Binary> {
///         let number: u64 = load(deps.storage, NUMBER_KEY)?.unwrap_or_default();
///         let number = to_binary(&number)?;
/// 
///         Ok(number)
///     }
/// }
/// 
/// let mut ensemble = ContractEnsemble::new();
/// let counter = ensemble.register(Box::new(Counter));
/// let counter = ensemble.instantiate(
///     counter.id,
///     &(),
///     MockEnv::new("sender", "counter_address")
/// )
/// .unwrap()
/// .instance;
/// 
/// ensemble.execute(
///     &ExecuteMsg::Increment,
///     MockEnv::new("sender", counter.address.clone())
/// ).unwrap();
/// 
/// let number: u64 = ensemble.query(&counter.address, &()).unwrap();
/// assert_eq!(number, 1);
/// 
/// ensemble.execute(
///     &ExecuteMsg::Reset,
///     MockEnv::new("sender", counter.address.clone())
/// ).unwrap();
/// 
/// let number: u64 = ensemble.query(&counter.address, &()).unwrap();
/// assert_eq!(number, 0);
/// ```
#[derive(Debug)]
pub struct ContractEnsemble {
    pub(crate) ctx: Box<Context>
}

pub(crate) struct Context {
    pub contracts: Vec<ContractUpload>,
    #[cfg(feature = "ensemble-staking")]
    pub delegations: Delegations,
    pub state: State,
    block: Block,
    chain_id: String
}

pub(crate) struct ContractUpload {
    code_hash: String,
    code: Box<dyn ContractHarness>
}

impl ContractEnsemble {
    /// Creates a new instance of the ensemble that will use
    /// "uscrt" as the native coin when the `scrt` feature is
    /// enabled. Otherwise, will use `uatom`.
    pub fn new() -> Self {
        #[cfg(feature = "scrt")]
        let denom = "uscrt";

        #[cfg(not(feature = "scrt"))]
        let denom = "uatom";

        Self {
            ctx: Box::new(Context::new(denom.into()))
        }
    }

    /// Creates a new instance of the ensemble that will use
    /// the provided denomination as the native coin.
    #[cfg(feature = "ensemble-staking")]
    pub fn new_with_denom(native_denom: impl Into<String>) -> Self {
        Self {
            ctx: Box::new(Context::new(native_denom.into()))
        }
    }

    /// Registers a contract with the ensemble which enables it to be
    /// called by the sender or by other contracts. Corresponds to the
    /// upload step of the real chain.
    /// 
    /// Returns the code id that must be use to create an instance of it
    /// and its unique code hash.
    pub fn register(&mut self, code: Box<dyn ContractHarness>) -> ContractCode {
        let id = self.ctx.contracts.len() as u64;
        let code_hash = format!("test_contract_{}", id);

        self.ctx.contracts.push(ContractUpload {
            code_hash: code_hash.clone(),
            code
        });

        ContractCode {
            id,
            code_hash
        }
    }

    /// Returns a reference to the current block state.
    #[inline]
    pub fn block(&self) -> &Block {
        &self.ctx.block
    }

    /// Returns a mutable reference to the current block state.
    /// Can be used to manually advance the block time and height
    /// or configure the auto advancement strategy. Auto advancement
    /// occurs on successful message execution.
    #[inline]
    pub fn block_mut(&mut self) -> &mut Block {
        &mut self.ctx.block
    }

    /// Sets that chain id string i.e `env.block.chain_id`.
    #[inline]
    pub fn set_chain_id(&mut self, id: impl Into<String>) {
        self.ctx.chain_id = id.into();
    }

    /// Adds the given funds that will be associated with the
    /// provided account's address. Can either be a contract or
    /// a mock user's address. You need to use this method first
    /// if you want to send a contract funds when using [`MockEnv::sent_funds`].
    #[inline]
    pub fn add_funds(&mut self, address: impl AsRef<str>, coins: Vec<Coin>) {
        for coin in coins {
            self.ctx.state.bank.add_funds(address.as_ref(), coin);
        }
    }

    /// Removes the given funds from the provided account's
    /// address. Can either be a contract or a mock user's address.
    /// The account must already exist and have at least the given amount
    /// in order for this to be a success.
    #[inline]
    pub fn remove_funds(&mut self, address: impl AsRef<str>, coin: Coin) -> EnsembleResult<()> {
        self.ctx.state.bank.remove_funds(address.as_ref(), coin)
    }

    /// Transfers funds from one account to another. The `from` address
    /// must have the sufficient amount.
    #[inline]
    pub fn transfer_funds(
        &mut self,
        from: impl AsRef<str>,
        to: impl AsRef<str>,
        coin: Coin
    ) -> EnsembleResult<()> {
        self.ctx.state.bank.transfer(
            from.as_ref(),
            to.as_ref(),
            coin
        )
    }

    /// Returns a reference to all the balances associated with the given
    /// account. Returns [`None`] if the account doesn't exist or hasn't
    /// received any funds before.
    /// 
    /// # Examples
    /// 
    /// ```
    /// use fadroma::cosmwasm_std::coin;
    /// use fadroma_ensemble::ContractEnsemble;
    /// 
    /// let mut ensemble = ContractEnsemble::new();
    /// ensemble.add_funds("wallet", vec![coin(100, "uscrt")]);
    /// 
    /// let balances = ensemble.balances("wallet").unwrap();
    /// assert_eq!(balances.get("uscrt").unwrap().u128(), 100);
    /// 
    /// assert!(ensemble.balances("absent").is_none());
    /// ```
    #[inline]
    pub fn balances(&self, address: impl AsRef<str>) -> Option<&Balances> {
        self.ctx.state.bank.0.get(address.as_ref())
    }

    /// Returns a mutable reference to all the balances associated with the
    /// given account. Returns [`None`] if the account doesn't exist or hasn't
    /// received any funds before.
    /// 
    /// # Examples
    /// 
    /// ```
    /// use fadroma::cosmwasm_std::{Uint128, coin};
    /// use fadroma_ensemble::ContractEnsemble;
    /// 
    /// let mut ensemble = ContractEnsemble::new();
    /// ensemble.add_funds("wallet", vec![coin(100, "uscrt")]);
    /// 
    /// let balances = ensemble.balances_mut("wallet").unwrap();
    /// let uscrt_balance = balances.get_mut("uscrt").unwrap();
    /// *uscrt_balance -= Uint128::from(50u128);
    ///
    /// let balances = ensemble.balances("wallet").unwrap();
    /// assert_eq!(balances.get("uscrt").unwrap().u128(), 50);
    ///
    /// assert!(ensemble.balances("absent").is_none());
    #[inline]
    pub fn balances_mut(&mut self, address: impl AsRef<str>) -> Option<&mut Balances> {
        self.ctx.state.bank.0.get_mut(address.as_ref())
    }

    /// Returns all active delegations associated with the given address.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn delegations(&self, address: impl AsRef<str>) -> Vec<Delegation> {
        self.ctx.delegations.all_delegations(address.as_ref())
    }

    /// Creates a new delegation for the given address using the given validator.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn delegation(
        &self,
        delegator: impl AsRef<str>,
        validator: impl AsRef<str>,
    ) -> Option<FullDelegation> {
        self.ctx
            .delegations
            .delegation(delegator.as_ref(), validator.as_ref())
    }

    /// Adds the validator to the validator list.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn add_validator(&mut self, validator: Validator) {
        self.ctx.delegations.add_validator(validator);
    }

    /// Distributes the given amount as rewards.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn add_rewards(&mut self, amount: impl Into<Uint128>) {
        self.ctx.delegations.distribute_rewards(amount.into());
    }

    /// Re-allow redelegating and deposit unbondings.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn fast_forward_delegation_waits(&mut self) {
        let unbondings = self.ctx.delegations.fast_forward_waits();

        for unbonding in unbondings {
            self.ctx.state.bank.add_funds(
                unbonding.delegator.as_str(),
                unbonding.amount
            );
        }
    }

    /// Provides read access to the storage associated with the given contract address.
    /// 
    /// Returns `Err` if a contract with `address` wasn't found.
    #[inline]
    pub fn contract_storage<F>(&self, address: impl AsRef<str>, borrow: F) -> EnsembleResult<()>
        where F: FnOnce(&dyn Storage)
    {
        let instance = self.ctx.state.instance(address.as_ref())?;
        borrow(&instance.storage as &dyn Storage);

        Ok(())
    }

    /// Provides write access to the storage associated with the given contract address.
    /// 
    /// Returns an `Err` if a contract with `address` wasn't found. In case an error
    /// is returned from the closure, the updates to that storage are discarded.
    pub fn contract_storage_mut<F>(&mut self, address: impl AsRef<str>, mutate: F) -> EnsembleResult<()>
        where F: FnOnce(&mut dyn Storage) -> EnsembleResult<()>
    {
        self.ctx.state.push_scope();
        let result = self.ctx.state.borrow_storage_mut(address.as_ref(), mutate);

        if result.is_ok() {
            self.ctx.state.commit();
        } else {
            self.ctx.state.revert();
        }

        result
    }

    /// Creates a new contract instance using the given code id. The code id
    /// must be obtained by calling the [`ContractEnsemble::register`] method first.
    /// 
    /// The contract will be assigned the address the was provided with
    /// the `env.contract` parameter.
    /// 
    /// The `instance` field of the response will contain this address and
    /// the code hash associated with this instance.
    pub fn instantiate<T: Serialize>(
        &mut self,
        code_id: u64,
        msg: &T,
        env: MockEnv
    ) -> EnsembleResult<InstantiateResponse> {
        let contract = self
            .ctx
            .contracts
            .get(code_id as usize)
            .ok_or_else(|| EnsembleError::registry(RegistryError::IdNotFound(code_id)))?;

        let sub_msg = SubMsg::new(WasmMsg::Instantiate {
            code_id,
            code_hash: contract.code_hash.clone(),
            msg: to_binary(msg)?,
            funds: env.sent_funds,
            label: env.contract.into_string(),
            admin: None
        });

        match self.ctx.execute_messages(sub_msg, env.sender.into_string())? {
            ResponseVariants::Instantiate(resp) => Ok(resp),
            _ => unreachable!()
        }
    }

    /// Executes the contract with the address provided in `env.contract`.
    pub fn execute<T: Serialize + ?Sized>(
        &mut self,
        msg: &T,
        env: MockEnv
    ) -> EnsembleResult<ExecuteResponse> {
        let address = env.contract.into_string();

        let instance = self.ctx.state.instance(&address)?;
        let code_hash = self.ctx.contracts[instance.index].code_hash.clone();

        let sub_msg = SubMsg::new(WasmMsg::Execute {
            contract_addr: address,
            code_hash,
            msg: to_binary(msg)?,
            funds: env.sent_funds
        });

        match self.ctx.execute_messages(sub_msg, env.sender.into_string())? {
            ResponseVariants::Execute(resp) => Ok(resp),
            _ => unreachable!()
        }
    }

    /// Queries the contract associated with the given address and
    /// attempts to deserialize its response to the given type parameter.
    #[inline]
    pub fn query<T: Serialize + ?Sized, R: DeserializeOwned>(
        &self,
        address: impl AsRef<str>,
        msg: &T
    ) -> EnsembleResult<R> {
        let result = self.query_raw(address, msg)?;
        let result = from_binary(&result)?;

        Ok(result)
    }

    /// Queries the contract associated with the given address without
    /// attempting to deserialize its response.
    #[inline]
    pub fn query_raw<T: Serialize + ?Sized>(
        &self,
        address: impl AsRef<str>,
        msg: &T
    ) -> EnsembleResult<Binary> {
        self.ctx.query(address.as_ref(), to_binary(msg)?)
    }
}

impl Context {
    #[cfg(not(feature = "ensemble-staking"))]
    fn new(_native_denom: String) -> Self {
        Self {
            contracts: vec![],
            state: State::new(),
            block: Block::default(),
            chain_id: "fadroma-ensemble-testnet".into()
        }
    }

    #[cfg(feature = "ensemble-staking")]
    fn new(native_denom: String) -> Self {
        Self {
            contracts: vec![],
            state: State::new(),
            delegations: Delegations::new(native_denom),
            block: Block::default(),
            chain_id: "fadroma-ensemble-testnet".into()
        }
    }

    fn instantiate(
        &mut self,
        id: u64,
        msg: Binary,
        env: MockEnv,
    ) -> EnsembleResult<InstantiateResponse> {
        // We check for validity in execute_sub_msg()
        let contract = &self.contracts[id as usize];

        let sender = env.sender.to_string();
        let address = env.contract.to_string();
        let code_hash = contract.code_hash.clone();

        self.state.create_contract_instance(address.clone(), id as usize)?;

        let (env, msg_info) = self.create_msg_deps(
            env,
            code_hash.clone()
        );

        let querier = EnsembleQuerier::new(&self);
        let response = self.state.borrow_storage_mut(&address, |storage| {
            let deps = DepsMut::<Empty> {
                storage,
                api: &MockApi::default() as &dyn Api,
                querier: QuerierWrapper::new(&querier as &dyn Querier)
            };

            let result = contract.code.instantiate(deps, env, msg_info, msg.clone())?;

            Ok(result)
        })?;

        Ok(InstantiateResponse {
            sent: Vec::with_capacity(response.messages.len()),
            sender,
            instance: ContractLink {
                address: Addr::unchecked(address),
                code_hash
            },
            code_id: id,
            msg,
            response
        })
    }

    fn execute(&mut self, msg: Binary, env: MockEnv) -> EnsembleResult<ExecuteResponse> {
        let address = env.contract.to_string();
        let (index, code_hash) = {
            let instance = self.state.instance(&address)?;
            let code_hash = self.contracts[instance.index].code_hash.clone();

            (instance.index, code_hash)
        };

        let (env, msg_info) = self.create_msg_deps(env, code_hash);
        let sender = msg_info.sender.to_string();
        
        let contract = &self.contracts[index];

        let querier = EnsembleQuerier::new(&self);
        let response = self.state.borrow_storage_mut(&address, |storage| {
            let deps = DepsMut::<Empty> {
                storage,
                api: &MockApi::default() as &dyn Api,
                querier: QuerierWrapper::new(&querier as &dyn Querier)
            };

            let result = contract.code.execute(deps, env, msg_info, msg.clone())?;

            Ok(result)
        })?;

        Ok(ExecuteResponse {
            sent: Vec::with_capacity(response.messages.len()),
            sender,
            address,
            msg,
            response
        })
    }

    pub(crate) fn query(&self, address: &str, msg: Binary) -> EnsembleResult<Binary> {
        let instance = self.state.instance(address)?;
        let contract = &self.contracts[instance.index];

        let env = self.create_env(ContractLink {
            address: Addr::unchecked(address),
            code_hash: contract.code_hash.clone()
        });

        let querier = EnsembleQuerier::new(&self);
        let deps = Deps::<Empty> {
            storage: &instance.storage as &dyn Storage,
            api: &MockApi::default() as &dyn Api,
            querier: QuerierWrapper::new(&querier as &dyn Querier)
        };

        let result = contract.code.query(deps, env, msg)?;

        Ok(result)
    }

    fn reply(&mut self, address: String, reply: Reply) -> EnsembleResult<ReplyResponse> {
        let (index, code_hash) = {
            let instance = self.state.instance(&address)?;
            let code_hash = self.contracts[instance.index].code_hash.clone();

            (instance.index, code_hash)
        };

        let env = self.create_env(ContractLink {
            address: Addr::unchecked(address.clone()),
            code_hash
        });

        let contract = &self.contracts[index];

        let querier = EnsembleQuerier::new(&self);
        let response = self.state.borrow_storage_mut(&address, |storage| {
            let deps = DepsMut::<Empty> {
                storage,
                api: &MockApi::default() as &dyn Api,
                querier: QuerierWrapper::new(&querier as &dyn Querier)
            };

            let result = contract.code.reply(deps, env, reply.clone())?;

            Ok(result)
        })?;

        Ok(ReplyResponse {
            sent: Vec::with_capacity(response.messages.len()),
            address,
            reply,
            response
        })
    }

    fn execute_messages(
        &mut self,
        msg: SubMsg,
        initial_sender: String
    ) -> EnsembleResult<ResponseVariants> {
        let mut state = ExecutionState::new(msg, initial_sender);

        while let Some(msg_ty) = state.next() {
            self.state.push_scope();

            let result = match msg_ty {
                MessageType::SubMsg { msg, sender } => {
                    self.execute_sub_msg(msg, sender)
                }
                MessageType::Reply { id, error, target } => {
                    let result = match error {
                        Some(err) => {
                            let reply = Reply {
                                id,
                                result: SubMsgResult::Err(err)
                            };

                            self.reply(target, reply)
                        },
                        None => {
                            let reply = Reply {
                                id,
                                result: SubMsgResult::Ok(SubMsgResponse {
                                    events: state.events().to_vec(),
                                    data: state.data().cloned()
                                })
                            };

                            self.reply(target, reply)
                        }
                    };

                    match result {
                        Ok(resp) => {
                            ProcessedEvents::try_from(&resp).and_then(|x|
                                Ok((resp.into(), x))
                            )
                        },
                        Err(err) => Err(err)
                    }
                }
            };

            match state.process_result(result) {
                Ok(mut msgs_reverted) => {
                    while msgs_reverted > 0 {
                        self.state.revert_scope();
                        msgs_reverted -= 1;
                    }
                },
                Err(err) => {
                    self.state.revert();
    
                    return Err(err);
                }
            }
        }

        self.block.next();
        self.state.commit();

        Ok(state.finalize())
    }

    fn execute_sub_msg(
        &mut self,
        sub_msg: SubMsg,
        sender: String,
    ) -> SubMsgExecuteResult {
        match sub_msg.msg {
            CosmosMsg::Wasm(msg) => match msg {
                WasmMsg::Execute {
                    contract_addr,
                    msg,
                    funds,
                    code_hash,
                } => {
                    let index = self.state.instance(&contract_addr)?.index;

                    if self.contracts[index].code_hash != code_hash {
                        return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
                    }

                    let mut events = if funds.is_empty() {
                        ProcessedEvents::empty()
                    } else {
                        let transfer_resp = self.state.transfer_funds(
                            &sender,
                            &contract_addr,
                            funds.clone()
                        )?;
    
                        ProcessedEvents::from(&transfer_resp)
                    };

                    let env = MockEnv::new(
                        sender,
                        contract_addr.clone()
                    ).sent_funds(funds);

                    let execute_resp = self.execute(msg, env)?;
                    events.extend(&execute_resp)?;

                    Ok((execute_resp.into(), events))
                }
                WasmMsg::Instantiate {
                    code_id,
                    msg,
                    funds,
                    label,
                    code_hash,
                    ..
                } => {
                    let contract = self
                        .contracts
                        .get(code_id as usize)
                        .ok_or_else(|| EnsembleError::registry(RegistryError::IdNotFound(code_id)))?;

                    if contract.code_hash != code_hash {
                        return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
                    }

                    let env = MockEnv::new_sanitized(
                        sender,
                        label
                    ).sent_funds(funds);

                    let mut events = if env.sent_funds.is_empty() {
                        ProcessedEvents::empty()
                    } else {
                        let transfer_resp = self.state.transfer_funds(
                            env.sender(),
                            env.contract(),
                            env.sent_funds.clone()
                        )?;
    
                        ProcessedEvents::from(&transfer_resp)
                    };

                    let instantiate_resp = self.instantiate(
                        code_id,
                        msg,
                        env
                    )?;

                    events.extend(&instantiate_resp)?;

                    Ok((instantiate_resp.into(), events))
                }
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            }
            CosmosMsg::Bank(msg) => match msg {
                BankMsg::Send {
                    to_address,
                    amount,
                } => {
                    let resp = self.state.transfer_funds(
                        &sender,
                        &to_address,
                        amount
                    )?;

                    let events = ProcessedEvents::from(&resp);

                    Ok((resp.into(), events))
                },
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            }
            #[cfg(feature = "ensemble-staking")]
            CosmosMsg::Staking(msg) => match msg {
                StakingMsg::Delegate { validator, amount } => {
                    self.state.remove_funds(&sender, vec![amount.clone()])?;

                    let resp = self.delegations.delegate(
                        sender.clone(),
                        validator,
                        amount
                    )?;

                    let events = ProcessedEvents::from(&resp);

                    Ok((resp.into(), events))
                }
                StakingMsg::Undelegate { validator, amount } => {
                    let resp = self.delegations.undelegate(
                        sender.clone(),
                        validator,
                        amount.clone(),
                    )?;

                    let events = ProcessedEvents::from(&resp);

                    Ok((resp.into(), events))
                }
                StakingMsg::Redelegate {
                    src_validator,
                    dst_validator,
                    amount,
                } => {
                    let resp = self.delegations.redelegate(
                        sender.clone(),
                        src_validator,
                        dst_validator,
                        amount,
                    )?;

                    let events = ProcessedEvents::from(&resp);

                    Ok((resp.into(), events))
                },
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            },
            #[cfg(feature = "ensemble-staking")]
            CosmosMsg::Distribution(msg) => match msg {
                DistributionMsg::WithdrawDelegatorReward { validator } => {
                    // Query accumulated rewards so bank transaction can take place first
                    let withdraw_amount = match self.delegations.delegation(&sender, &validator) {
                        Some(amount) => amount.accumulated_rewards,
                        None => return Err(EnsembleError::Staking("Delegation not found".into())),
                    };

                    self.state.add_funds(sender.clone(), withdraw_amount);

                    let resp = self.delegations.withdraw(sender, validator)?;
                    let events = ProcessedEvents::from(&resp);

                    Ok((resp.into(), events))
                },
                _ => unimplemented!()
            }
            _ => panic!("Ensemble: Unsupported message: {:?}", sub_msg)
        }
    }

    #[inline]
    fn create_msg_deps(&self, env: MockEnv, code_hash: String) -> (Env, MessageInfo) {
        (
            self.create_env(ContractLink {
                address: env.contract,
                code_hash
            }),
            MessageInfo {
                sender: env.sender,
                funds: env.sent_funds
            }
        )
    }

    #[inline]
    fn create_env(&self, contract: ContractLink<Addr>) -> Env {
        let seed = 94759574359011638572u128.wrapping_mul(self.block.height as u128);
        
        let mut rng = Rand64::new(seed);
        let bytes = rng.rand_u64().to_le_bytes();

        Env {
            block: BlockInfo {
                height: self.block.height,
                time: Timestamp::from_seconds(self.block.time),
                chain_id: self.chain_id.clone(),
                random: Some(Binary::from(bytes))
            },
            transaction: None,
            contract: ContractInfo {
                address: contract.address,
                code_hash: contract.code_hash,
            }
        }
    }
}

impl Debug for Context {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Context")
            .field("contracts_len", &self.contracts.len())
            .field("block", &self.block)
            .field("chain_id", &self.chain_id)
            .finish()
    }
}

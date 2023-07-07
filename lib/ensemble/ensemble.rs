use std::{fmt::Debug, convert::TryFrom};
use serde::{Serialize, de::DeserializeOwned};
use oorandom::Rand64;
use crate::{
    prelude::{ContractCode, ContractLink},
    cosmwasm_std::{*, testing::*},
};
#[cfg(feature = "ensemble-staking")]
use crate::cosmwasm_std::{Uint128, FullDelegation, Validator, Delegation, StakingMsg, DistributionMsg};
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
#[allow(unused)]
pub trait ContractHarness {
    fn instantiate(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary)
        -> AnyResult<Response>
    {
        panic!("ContractHarness::instantiate not implemented.")
    }

    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary)
        -> AnyResult<Response>
    {
        panic!("ContractHarness::execute not implemented.")
    }

    fn query(&self, deps: Deps, env: Env, msg: Binary) ->
        AnyResult<Binary>
    {
        panic!("ContractHarness::query not implemented.")
    }

    fn reply(&self, _deps: DepsMut, _env: Env, _reply: Reply)
        -> AnyResult<Response>
    {
        panic!("ContractHarness::reply not implemented.")
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
///     ensemble::{ContractEnsemble, ContractHarness, MockEnv, EnsembleResult, AnyResult},
///     serde::{Serialize, Deserialize},
///     schemars::JsonSchema
/// };
/// 
/// const NUMBER_KEY: &[u8] = b"number";
/// 
/// struct Counter;
/// 
/// #[derive(Serialize, Deserialize, JsonSchema)]
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
    /// Create a new instance of the ensemble that will use
    /// "uscrt" as the native coin when the `scrt` feature is
    /// enabled. Otherwise, will use `uatom`.
    pub fn new() -> Self {
        #[cfg(feature = "scrt")]
        let denom = "uscrt";
        #[cfg(not(feature = "scrt"))]
        let denom = "uatom";
        Self { ctx: Box::new(Context::new(denom.into())) }
    }
    /// Create a new instance of the ensemble that will use
    /// the provided denomination as the native coin.
    #[cfg(feature = "ensemble-staking")]
    pub fn new_with_denom(native_denom: impl Into<String>) -> Self {
        Self { ctx: Box::new(Context::new(native_denom.into())) }
    }
    /// Register a contract with the ensemble which enables it to be
    /// called by the sender or by other contracts. Corresponds to the
    /// upload step of the real chain.
    /// 
    /// Returns the code id that must be use to create an instance of it
    /// and its unique code hash.
    pub fn register(&mut self, code: Box<dyn ContractHarness>) -> ContractCode {
        let id = self.ctx.contracts.len() as u64;
        let code_hash = format!("test_contract_{}", id);
        self.ctx.contracts.push(ContractUpload { code_hash: code_hash.clone(), code });
        ContractCode { id, code_hash }
    }
    /// Returns a reference to the current block state.
    #[inline]
    pub fn block(&self) -> &Block {
        &self.ctx.block
    }
    /// Return a mutable reference to the current block state.
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
    /// Add the given funds that will be associated with the
    /// provided account's address. Can either be a contract or
    /// a mock user's address. You need to use this method first
    /// if you want to send a contract funds when using [`MockEnv::sent_funds`].
    #[inline]
    pub fn add_funds(&mut self, address: impl AsRef<str>, coins: Vec<Coin>) {
        for coin in coins {
            self.ctx.state.bank.add_funds(address.as_ref(), coin);
        }
    }
    /// Remove the given funds from the provided account's
    /// address. Can either be a contract or a mock user's address.
    /// The account must already exist and have at least the given amount
    /// in order for this to be a success.
    #[inline]
    pub fn remove_funds(&mut self, address: impl AsRef<str>, coin: Coin) -> EnsembleResult<()> {
        self.ctx.state.bank.remove_funds(address.as_ref(), coin)
    }
    /// Transfer funds from one account to another. The `from` address
    /// must have the sufficient amount.
    #[inline]
    pub fn transfer_funds(
        &mut self,
        from: impl AsRef<str>,
        to: impl AsRef<str>,
        coin: Coin
    ) -> EnsembleResult<()> {
        self.ctx.state.bank.transfer(from.as_ref(), to.as_ref(), coin)
    }
    /// Return a reference to all the balances associated with the given
    /// account. Returns [`None`] if the account doesn't exist or hasn't
    /// received any funds before.
    /// 
    /// # Examples
    /// 
    /// ```
    /// use fadroma::{
    ///     ensemble::ContractEnsemble,
    ///     cosmwasm_std::coin
    /// };
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
    /// Return a mutable reference to all the balances associated with the
    /// given account. Returns [`None`] if the account doesn't exist or hasn't
    /// received any funds before.
    /// 
    /// # Examples
    /// 
    /// ```
    /// use fadroma::{
    ///     ensemble::ContractEnsemble,
    ///     cosmwasm_std::{Uint128, coin}
    /// };
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
    /// ```
    #[inline]
    pub fn balances_mut(&mut self, address: impl AsRef<str>) -> Option<&mut Balances> {
        self.ctx.state.bank.0.get_mut(address.as_ref())
    }
    /// Return all active delegations associated with the given address.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn delegations(&self, address: impl AsRef<str>) -> Vec<Delegation> {
        self.ctx.delegations.all_delegations(address.as_ref())
    }
    /// Create a new delegation for the given address using the given validator.
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
    /// Distribute the given amount as rewards.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn add_rewards(&mut self, amount: impl Into<Uint128>) {
        self.ctx.delegations.distribute_rewards(amount.into());
    }
    /// Re-allow redelegating and deposit unbondings.
    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn fast_forward_delegation_waits(&mut self) {
        for unbonding in self.ctx.delegations.fast_forward_waits() {
            self.ctx.state.bank.add_funds(
                unbonding.delegator.as_str(),
                unbonding.amount
            );
        }
    }
    /// Provide read access to the storage associated with the given contract address.
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
    /// Provide write access to the storage associated with the given contract address.
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
    /// Create a new contract instance using the given code id. The code id
    /// must be obtained by calling the [`ContractEnsemble::register`] method first.
    /// 
    /// The contract will be assigned the address the was provided with
    /// the `env.contract` parameter.
    /// 
    /// The `instance` field of the response will contain this address and
    /// the code hash associated with this instance.
    pub fn instantiate<T: Serialize>(&mut self, code_id: u64, msg: &T, env: MockEnv) ->
        EnsembleResult<InstantiateResponse>
    {
        let contract = self.ctx.contracts.get(code_id as usize).ok_or_else(
            || EnsembleError::registry(RegistryError::IdNotFound(code_id)))?;
        match self.ctx.execute_messages(SubMsg::new(WasmMsg::Instantiate {
            code_id,
            code_hash: contract.code_hash.clone(),
            msg: to_binary(msg)?,
            funds: env.sent_funds,
            label: env.contract.into_string()
        }), env.sender.into_string())? {
            ResponseVariants::Instantiate(resp) => Ok(resp),
            _ => unreachable!()
        }
    }
    /// Execute the contract with the address provided in `env.contract`.
    pub fn execute<T: Serialize + ?Sized>(&mut self, msg: &T, env: MockEnv)
        -> EnsembleResult<ExecuteResponse>
    {
        let address = env.contract.into_string();
        let instance = self.ctx.state.instance(&address)?;
        let code_hash = self.ctx.contracts[instance.index].code_hash.clone();
        match self.ctx.execute_messages(SubMsg::new(WasmMsg::Execute {
            contract_addr: address,
            code_hash,
            msg: to_binary(msg)?,
            funds: env.sent_funds
        }), env.sender.into_string())? {
            ResponseVariants::Execute(resp) => Ok(resp),
            _ => unreachable!()
        }
    }
    /// Query the contract associated with the given address and
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
    /// Query the contract associated with the given address without
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
        Ok(contract.code.query(deps, env, msg)?)
    }

    fn reply(&mut self, address: String, reply: Reply) -> EnsembleResult<ReplyResponse> {
        let index = self.state.instance(&address)?.index;
        let code_hash = self.contracts[index].code_hash.clone();
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
        let sent = Vec::with_capacity(response.messages.len());
        Ok(ReplyResponse { sent, address, reply, response })
    }

    // Create and execute a message stack.
    // Called from `ContractEnsemble::instantiate` or `ContractEnsemble::execute`
    fn execute_messages(&mut self, msg: SubMsg, initial_sender: String)
        -> EnsembleResult<ResponseVariants>
    {
        // Create a new execution stack, starting with the initial message.
        let mut stack = Stack::new(msg, initial_sender);
        // Recursively execute: the initial message, then any messages that
        // it added to the stack, and so on until the whole transaction is executed.
        while let Some(msg) = stack.take_next() {
            self.state.push_scope();
            // Execute the next step in the stack, which may be either
            // the reply from the previous message, or a new message.
            let result = self.execute_message(&mut stack, msg);
            // Update the stack and state according to the result from the contract.
            // - If contract execution is successful, nothing is reverted.
            // - If contract returns error, a number of frames/scopes
            //   are reverted.
            // - If a non-contract error occurs, everything is reverted
            //   and the error is rethrown.
            match stack.process_result(result) {
                Ok(mut to_revert) => {
                    while to_revert > 0 {
                        self.state.revert_scope();
                        to_revert -= 1;
                    }
                },
                Err(err) => {
                    self.state.revert();
                    return Err(err);
                }
            }
        }
        // Advance time
        self.block.next();
        // Commit strate mutations
        self.state.commit();
        // Validate the state of the stack,
        // and return the response to the initial message.
        Ok(stack.finalize())
    }

    fn execute_message (&mut self, stack: &mut Stack, msg: NextMessage) -> SubMsgExecuteResult {
        match msg {
            NextMessage::Reply { id, error, target } =>
                self.execute_reply(stack, id, error, target),
            NextMessage::SubMsg { msg, sender } =>
                self.execute_submsg(msg, sender),
        }
    }

    fn execute_reply(
        &mut self, state: &mut Stack, id: u64, error: Option<String>, target: String
    ) -> SubMsgExecuteResult {
        let result = match error {
            Some(err) =>
                SubMsgResult::Err(err),
            None =>
                SubMsgResult::Ok(SubMsgResponse {
                    events: state.events().to_vec(),
                    data: state.data().cloned()
                })
        };
        match self.reply(target, Reply { id, result }) {
            Ok(resp) => ProcessedEvents::try_from(&resp).and_then(|x|Ok((resp.into(), x))),
            Err(err) => Err(err)
        }
    }

    fn execute_submsg(&mut self, submsg: SubMsg, sender: String) -> SubMsgExecuteResult {
        match submsg.msg {
            CosmosMsg::Wasm(msg) => self.execute_submsg_wasm(msg, sender),
            CosmosMsg::Bank(msg) => self.execute_submsg_bank(msg, sender),
            #[cfg(feature = "ensemble-staking")]
            CosmosMsg::Staking(msg) => self.execute_submsg_staking(msg, sender),
            #[cfg(feature = "ensemble-staking")]
            CosmosMsg::Distribution(msg) => self.execute_submsg_distribution(msg, sender),
            _ => panic!("Ensemble: Unsupported message: {:?}", submsg)
        }
    }

    fn execute_submsg_wasm (&mut self, msg: WasmMsg, sender: String)
        -> SubMsgExecuteResult
    {
        match msg {
            WasmMsg::Instantiate { code_id, msg, funds, label, code_hash } => {
                let contract = self.contracts.get(code_id as usize).ok_or_else(
                    || EnsembleError::registry(RegistryError::IdNotFound(code_id)))?;
                if contract.code_hash != code_hash {
                    return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
                }
                let env = MockEnv::new_sanitized(sender, label).sent_funds(funds);
                let mut events = if env.sent_funds.is_empty() {
                    ProcessedEvents::empty()
                } else {
                    ProcessedEvents::from(&self.state.transfer_funds(
                        env.sender(),
                        env.contract(),
                        env.sent_funds.clone()
                    )?)
                };
                let instantiate_resp = self.instantiate(
                    code_id,
                    msg,
                    env
                )?;
                events.extend(&instantiate_resp)?;
                Ok((instantiate_resp.into(), events))
            },
            WasmMsg::Execute { contract_addr, msg, funds, code_hash, } => {
                let index = self.state.instance(&contract_addr)?.index;
                if self.contracts[index].code_hash != code_hash {
                    return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
                }
                let mut events = if funds.is_empty() {
                    ProcessedEvents::empty()
                } else {
                    ProcessedEvents::from(&self.state.transfer_funds(
                        &sender,
                        &contract_addr,
                        funds.clone()
                    )?)
                };
                let env = MockEnv::new(sender, contract_addr.clone()).sent_funds(funds);
                let execute_resp = self.execute(msg, env)?;
                events.extend(&execute_resp)?;
                Ok((execute_resp.into(), events))
            }
            _ => panic!("Ensemble: Unsupported message: {:?}", msg)
        }
    }

    fn instantiate(
        &mut self,
        code_id: u64,
        msg: Binary,
        env: MockEnv,
    ) -> EnsembleResult<InstantiateResponse> {
        // We check for validity in execute_submsg()
        let contract = &self.contracts[code_id as usize];
        let sender = env.sender.to_string();
        let address = env.contract.to_string();
        let code_hash = contract.code_hash.clone();
        self.state.create_contract_instance(address.clone(), code_id as usize)?;
        let (env, msg_info) = self.create_msg_deps(env, code_hash.clone());
        let querier = EnsembleQuerier::new(&self);
        let response = self.state.borrow_storage_mut(&address, |storage| {
            let api = &MockApi::default() as &dyn Api;
            let querier = QuerierWrapper::new(&querier as &dyn Querier);
            let deps = DepsMut::<Empty> { storage, api, querier };
            Ok(contract.code.instantiate(deps, env, msg_info, msg.clone())?)
        })?;
        let sent = Vec::with_capacity(response.messages.len());
        let instance = ContractLink { address: Addr::unchecked(address), code_hash };
        Ok(InstantiateResponse { sent, sender, instance, code_id, msg, response })
    }

    fn execute(&mut self, msg: Binary, env: MockEnv) -> EnsembleResult<ExecuteResponse> {
        let address = env.contract.to_string();
        let index = self.state.instance(&address)?.index;
        let code_hash = self.contracts[index].code_hash.clone();
        let (env, msg_info) = self.create_msg_deps(env, code_hash);
        let sender = msg_info.sender.to_string();
        let contract = &self.contracts[index];
        let querier = EnsembleQuerier::new(&self);
        let response = self.state.borrow_storage_mut(&address, |storage| {
            let api = &MockApi::default() as &dyn Api;
            let querier = QuerierWrapper::new(&querier as &dyn Querier);
            let deps = DepsMut::<Empty> { storage, api, querier };
            Ok(contract.code.execute(deps, env, msg_info, msg.clone())?)
        })?;
        let sent = Vec::with_capacity(response.messages.len());
        Ok(ExecuteResponse { sent, sender, address, msg, response })
    }

    fn execute_submsg_bank (&mut self, msg: BankMsg, sender: String)
        -> SubMsgExecuteResult
    {
        match msg {
            BankMsg::Send { to_address, amount } => {
                let resp = self.state.transfer_funds(&sender, &to_address, amount)?;
                let events = ProcessedEvents::from(&resp);
                Ok((resp.into(), events))
            },
            _ => panic!("Ensemble: Unsupported message: {:?}", msg)
        }
    }

    #[cfg(feature = "ensemble-staking")]
    fn execute_submsg_staking (&mut self, msg: StakingMsg, sender: String)
        -> SubMsgExecuteResult
    {
        match msg {
            StakingMsg::Delegate { validator, amount } => {
                self.state.remove_funds(&sender, vec![amount.clone()])?;
                let resp = self.delegations.delegate(sender.clone(), validator, amount)?;
                let events = ProcessedEvents::from(&resp);
                Ok((resp.into(), events))
            }
            StakingMsg::Undelegate { validator, amount } => {
                let resp = self.delegations.undelegate(sender.clone(),
                    validator,
                    amount.clone(),
                )?;
                let events = ProcessedEvents::from(&resp);
                Ok((resp.into(), events))
            }
            StakingMsg::Redelegate { src_validator, dst_validator, amount, } => {
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
        }
    }

    #[cfg(feature = "ensemble-staking")]
    fn execute_submsg_distribution (&mut self, msg: DistributionMsg, sender: String)
        -> SubMsgExecuteResult
    {
        match msg {
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

/// An execution stack, keeping track of messages and replies.
#[derive(Debug)]
pub(crate) struct Stack {
    /// Execution slot: contains next message to execute.
    next: Option<NextMessage>,
    /// State frames in the stack.
    pub(crate) frames: Vec<Frame>,
}

#[derive(Debug)]
pub enum NextMessage {
    SubMsg { msg: SubMsg, sender: String },
    Reply { id: u64, error: Option<String>, target: String }
}

impl Stack {
    /// Create a new execution stack from a single message.
    /// As a result of executing this message, more replies
    /// and messages may be recursively appended to the stack.
    /// (Called at beginning of `Context::execute_messages`.)
    #[inline]
    pub fn new(msg: SubMsg, sender: String) -> Self {
        // The initial message is passed from outside, therefore
        // it may not have a `reply_on` value other than `Never`.
        assert_eq!(msg.reply_on, ReplyOn::Never);
        // Create a new instance of `Stack` with a single state frame,
        // and the initial message in the execution slot.
        let frames = vec![Frame::new_done(&msg)];
        let next = Some(NextMessage::SubMsg { msg, sender });
        Self { next, frames }
        // From here, `Context::execute_messages` will repeatedly:
        // - pass the `next` message to the corresponding contract,
        // - call `Stack::process_result` w/the result from the contract.
        // The latter may add new `frames` and set `next` to a new value;
        // if it doesn't, that means execution is over.
    }
    /// Return the next message in this stack, if present,
    /// resetting `self.next` to `None`.
    #[inline]
    pub fn take_next(&mut self) -> Option<NextMessage> {
        self.next.take()
    }
    /// Process the next result. (Called from `Context::execute_messages`
    /// as long as `Stack::next()` returns new replies or messages for
    /// the contract to execute.) Return the number of frames to revert.
    pub fn process_result(&mut self, result: SubMsgExecuteResult) -> EnsembleResult<usize> {
        super::display::print_submsg_execute_result(&self, &result);
        match result {
            Ok((response, events)) =>
                self.on_success(response, events),
            Err(err) if err.is_contract_error() =>
                self.on_error(err),
            Err(err) =>
                Err(err)
        }
    }
    /// Assert that this stack is fully executed, and that
    /// there exists exactly one final response. Return that response.
    pub fn finalize(mut self) -> ResponseVariants {
        assert!(self.frames.len() == 1 && self.next.is_none());
        assert_eq!(self.frames[0].responses.len(), 1);
        //super::display::print_finalized_execution_state(&self);
        self.frames[0].responses.pop().unwrap()
    }
    /// If contract execution succeeded:
    /// - 0 frames need to be reverted
    /// - New frames may be added to the stack
    fn on_success (&mut self, response: ResponseVariants, events: ProcessedEvents)
        -> EnsembleResult<usize>
    {
        println!("Response: {response:#?}\nEvents: {events:#?}");
        // Replies will overwrite the caller data if they return Some.
        if let Some(contract_response) = response.response() {
            if response.is_reply() && contract_response.data.is_some() {
                // If this is a reply, add the data to the caller frame.
                let index = self.frames.len() - 2;
                self.frames[index].data = contract_response.data.clone();
            } else {
                // Otherwise add it to the current frame.
                self.current_frame_mut().data = contract_response.data.clone();
            }
        }
        // Update current frame, adding results from contract call:
        let frame = self.current_frame_mut();
        // - Add the events from the contract to the current frame's events.
        frame.current_msg_mut().events.extend(events.take());
        let messages = response.messages().to_vec();
        println!("Frame: {frame:#?}\nMessages: {messages:#?}");
        // - Add the response from the contract to the current frame's responses.
        frame.responses.push(response);
        // - If the contract response contains any messages,
        //   add them to the stack as a new frame.
        if messages.len() > 0 {
            self.frames.push(Frame::new(messages));
        }
        // Find the next message to execute.
        self.update_next(None, |r| matches!(r, ReplyOn::Always | ReplyOn::Success));
        Ok(0)
    }
    /// If contract returned error:
    /// - If there is no next message, the error is returned.
    /// - If there is a next message, the number of states to revert is returned,
    ///   and the caller contract is allowed to handle the error.
    fn on_error (&mut self, err: EnsembleError) -> EnsembleResult<usize> {
        let to_revert = self.update_next(Some(err.to_string()),
            |r| matches!(r, ReplyOn::Always | ReplyOn::Error));
        if self.next.is_none() {
            // If a contract returned an error but no caller
            // could "catch" it, the entire TX should be reverted.
            Err(err)
        } else {
            // +1 because we have to revert the current scope as well
            Ok(to_revert + 1)
        }
    }
    /// Find the next message to execute according to the given predicate,
    /// set it in `self.next`, and return the number of frames to revert
    /// (minus one, which is added by `Stack::on_error`).
    fn update_next<F: Fn(&ReplyOn) -> bool>(&mut self, error: Option<String>, test: F) -> usize {
        assert!(self.next.is_none());
        let start_index = self.frames.len() - 1;
        let mut to_revert = 0;
        loop {
            if self.frames.is_empty() {
                break;
            }
            let index = self.frames.len() - 1;
            match self.frames[index].current_msg().state {
                SubMsgState::NotExecuted => {
                    let frame = &mut self.frames[index];
                    let current = frame.current_msg_mut();
                    current.state = if current.msg.reply_on == ReplyOn::Never {
                        SubMsgState::Done
                    } else {
                        SubMsgState::ShouldReply
                    };
                    self.next = Some(NextMessage::SubMsg {
                        msg: current.msg.clone(),
                        sender: self.current_sender()
                    });
                    break;
                },
                SubMsgState::Done => {
                    if error.is_some() {
                        to_revert += self.pop().responses.len();
                    } else {
                        let frame = &mut self.frames[index];
                        frame.next_msg();
                        // If we don't have a next node and we are currently
                        // at the root then we are finished.
                        if !frame.has_next_msg() && !self.squash_latest() {
                            break;
                        }
                    }
                }
                SubMsgState::ShouldReply => {
                    let reply = self.find_reply(error.clone(), &test);
                    if error.is_some() {
                        if reply.is_some() {
                            // We only do this if we have already recursed up
                            // (i.e this is not the first iteration of the loop) otherwise,
                            // the response wasn't added to begin with since we have an error.
                            if index != start_index {
                                let state = &mut self.frames[index];
                                state.responses.pop();
                                to_revert += 1;
                            }
                        } else {
                            to_revert += self.pop().responses.len();

                            continue;
                        }
                    }
                    self.next = reply;
                    self.frames[index].current_msg_mut().state = SubMsgState::Replying;
                    break;
                }
                SubMsgState::Replying => {
                    if error.is_some() {
                        to_revert += self.pop().responses.len();
                    } else {
                        self.frames[index].current_msg_mut().state = SubMsgState::Done;
                    }
                }
            }
        }
        to_revert
    }

    #[inline]
    pub fn events(&self) -> &[Event] {
        &self.current_frame().current_msg().events
    }

    #[inline]
    pub fn data(&mut self) -> Option<&Binary> {
        self.current_frame_mut().data.as_ref()
    }

    /// Return the address of the message sender for the current frame.
    /// Where does the magic number 2 come from?
    fn current_sender(&self) -> String {
        contract_address(self.frames[self.frames.len() - 2].responses.last().unwrap()).to_string()
    }

    fn find_reply<F>(&self, error: Option<String>, test: &F) -> Option<NextMessage>
        where F: Fn(&ReplyOn) -> bool
    {
        if self.frames.len() < 2 {
            None
        } else {
            let current = self.current_frame().current_msg();
            if test(&current.msg.reply_on) {
                let index = self.frames.len() - 2;
                let target = contract_address(self.frames[index].responses.last().unwrap());
                Some(NextMessage::Reply { id: current.msg.id, error, target: target.to_string() })
            } else {
                None
            }
        }
    }

    fn squash_latest(&mut self) -> bool {
        if self.frames.len() <= 1 {
            false
        } else {
            let latest = self.pop();
            let frame = self.current_frame_mut();
            frame.responses.last_mut().unwrap().add_responses(latest.responses);
            let len = latest.msgs.iter().map(|x| x.events.len()).sum();
            let mut events = Vec::with_capacity(len);
            for x in latest.msgs {
                events.extend(x.events);
            }
            frame.current_msg_mut().events.extend(events);
            true
        }
    }

    #[inline]
    fn current_frame_mut(&mut self) -> &mut Frame {
        self.frames.last_mut().unwrap()
    }

    #[inline]
    fn current_frame(&self) -> &Frame {
        self.frames.last().unwrap()
    }

    #[inline]
    fn pop(&mut self) -> Frame {
        self.frames.pop().unwrap()
    }
}

#[derive(Debug)]
pub(crate) struct Frame {
    pub(crate) data:      Option<Binary>,
    pub(crate) responses: Vec<ResponseVariants>,
    pub(crate) msgs:      Vec<SubMsgNode>,
    pub(crate) msg_index: usize
}

impl Frame {
    fn new(msgs: Vec<SubMsg>) -> Self {
        assert!(!msgs.is_empty());
        Self {
            data: None,
            responses: Vec::with_capacity(msgs.len()),
            msg_index: 0,
            msgs: msgs.into_iter().map(|x| SubMsgNode::new(x)).collect()
        }
    }

    fn new_done(msg: &SubMsg) -> Self {
        let mut frame = Self::new(vec![msg.clone()]);
        frame.current_msg_mut().state = SubMsgState::Done;
        frame
    }

    #[inline]
    fn current_msg(&self) -> &SubMsgNode {
        &self.msgs[self.msg_index]
    }

    #[inline]
    fn current_msg_mut(&mut self) -> &mut SubMsgNode {
        &mut self.msgs[self.msg_index]
    }

    #[inline]
    fn next_msg(&mut self) {
        assert_eq!(self.current_msg().state, SubMsgState::Done);
        self.msg_index += 1;
    }

    #[inline]
    fn has_next_msg(&self) -> bool {
        self.msg_index < self.msgs.len()
    }
}

#[derive(Debug)]
pub(crate) struct SubMsgNode {
    pub(crate) msg:    SubMsg,
    pub(crate) state:  SubMsgState,
    pub(crate) events: Vec<Event>
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub(crate) enum SubMsgState {
    NotExecuted,
    ShouldReply,
    Replying,
    Done
}

impl SubMsgNode {
    #[inline]
    fn new(msg: SubMsg) -> Self {
        Self { msg, state: SubMsgState::NotExecuted, events: vec![] }
    }
}

#[inline]
fn contract_address(resp: &ResponseVariants) -> &str {
    match resp {
        ResponseVariants::Instantiate(resp) => resp.instance.address.as_str(),
        ResponseVariants::Execute(resp) => &resp.address,
        ResponseVariants::Reply(resp) => &resp.address,
        ResponseVariants::Bank(_) => unreachable!(),
        #[cfg(feature = "ensemble-staking")]
        ResponseVariants::Staking(_) => unreachable!(),
        #[cfg(feature = "ensemble-staking")]
        ResponseVariants::Distribution(_) => unreachable!()
    }
}

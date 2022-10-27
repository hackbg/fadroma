use std::fmt::{Debug, Display};
use serde::{
    Serialize,
    de::DeserializeOwned
};

use crate::{
    prelude::{ContractInstantiationInfo, ContractLink},
    cosmwasm_std::{
        SubMsg, Deps, DepsMut, Env, StdError, Response, MessageInfo, Binary, Uint128, Coin,
        FullDelegation, Validator, Delegation, CosmosMsg, WasmMsg, BlockInfo, ContractInfo,
        StakingMsg, BankMsg, DistributionMsg, Timestamp, Addr, Reply, ReplyOn, SubMsgResult,
        SubMsgResponse, Storage, Api, Querier, QuerierWrapper, Empty, from_binary, to_binary,
        testing::MockApi
    }
};

use super::{
    bank::Balances,
    block::Block,
    env::MockEnv,
    querier::EnsembleQuerier,
    response::{ResponseVariants, ExecuteResponse, InstantiateResponse, ReplyResponse},
    staking::Delegations,
    state::State
};

pub type AnyResult<T> = anyhow::Result<T>;
pub type EnsembleResult<T> = core::result::Result<T, EnsembleError>;

pub trait ContractHarness {
    fn instantiate(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn execute(&self, deps: DepsMut, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn query(&self, deps: Deps, env: Env, msg: Binary) -> AnyResult<Binary>;

    fn reply(&self, _deps: DepsMut, _env: Env, _reply: Reply) -> AnyResult<Response> {
        panic!("Reply entry point not implemented.")
    }
}

#[derive(Debug)]
pub enum EnsembleError {
    ContractError(anyhow::Error),
    ContractNotFound(String),
    ContractDuplicateAddress(String),
    ContractIdNotFound(u64),
    InvalidCodeHash(String),
    Bank(String),
    Staking(String),
    Std(StdError)
}

#[derive(Debug)]
pub struct ContractEnsemble {
    pub(crate) ctx: Box<Context>
}

pub(crate) struct Context {
    pub contracts: Vec<ContractUpload>,
    pub delegations: Delegations,
    pub state: State,
    block: Block,
    chain_id: String
}

pub(crate) struct ContractUpload {
    code_hash: String,
    code: Box<dyn ContractHarness>
}

struct SubMsgExecState {
    responses: Vec<ResponseExecState>,
    initial: Option<SubMsg>
}

struct ResponseExecState {
    response: ResponseVariants,
    index: usize
}

impl ContractEnsemble {
    pub fn new() -> Self {
        #[cfg(feature = "scrt")]
        let denom = "uscrt";

        #[cfg(not(feature = "scrt"))]
        let denom = "uatom";

        Self {
            ctx: Box::new(Context::new(denom.into()))
        }
    }

    pub fn new_with_denom(native_denom: impl Into<String>) -> Self {
        Self {
            ctx: Box::new(Context::new(native_denom.into()))
        }
    }

    pub fn register(&mut self, code: Box<dyn ContractHarness>) -> ContractInstantiationInfo {
        let id = self.ctx.contracts.len() as u64;
        let code_hash = format!("test_contract_{}", id);

        self.ctx.contracts.push(ContractUpload {
            code_hash: code_hash.clone(),
            code
        });

        ContractInstantiationInfo {
            id,
            code_hash
        }
    }

    #[inline]
    pub fn block(&self) -> &Block {
        &self.ctx.block
    }

    #[inline]
    pub fn block_mut(&mut self) -> &mut Block {
        &mut self.ctx.block
    }

    #[inline]
    pub fn set_chain_id(&mut self, id: impl Into<String>) {
        self.ctx.chain_id = id.into();
    }

    #[inline]
    pub fn add_funds(&mut self, address: impl AsRef<str>, coins: Vec<Coin>) {
        for coin in coins {
            self.ctx.state.bank.add_funds(address.as_ref(), coin);
        }
    }

    #[inline]
    pub fn remove_funds(&mut self, address: impl AsRef<str>, coin: Coin) -> EnsembleResult<()> {
        self.ctx.state.bank.remove_funds(address.as_ref(), coin)
    }

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

    #[inline]
    pub fn balances(&self, address: impl AsRef<str>) -> Option<&Balances> {
        self.ctx.state.bank.0.get(address.as_ref())
    }

    #[inline]
    pub fn balances_mut(&mut self, address: impl AsRef<str>) -> Option<&mut Balances> {
        self.ctx.state.bank.0.get_mut(address.as_ref())
    }

    #[inline]
    pub fn delegations(&self, address: impl AsRef<str>) -> Vec<Delegation> {
        self.ctx.delegations.all_delegations(address.as_ref())
    }

    #[inline]
    pub fn delegation(
        &self,
        delegator: impl AsRef<str>,
        validator: impl AsRef<str>,
    ) -> Option<FullDelegation> {
        self.ctx
            .delegations
            .delegation(delegator.as_ref(), validator.as_ref())
    }

    #[inline]
    pub fn add_validator(&mut self, validator: Validator) {
        self.ctx.delegations.add_validator(validator);
    }

    #[inline]
    pub fn add_rewards(&mut self, amount: Uint128) {
        self.ctx.delegations.distribute_rewards(amount);
    }

    /// Re-allow redelegating and deposit unbondings
    #[inline]
    pub fn fast_forward_delegation_waits(&mut self) {
        let unbondings = self.ctx.delegations.fast_forward_waits();

        for unbonding in unbondings {
            self.ctx.state.bank.add_funds(
                unbonding.delegator.as_str(),
                unbonding.amount
            );
        }
    }

    /// Returns an `Err` if a contract with `address` wasn't found.
    #[inline]
    pub fn contract_storage<F>(&self, address: impl AsRef<str>, borrow: F) -> EnsembleResult<()>
        where F: FnOnce(&dyn Storage)
    {
        let instance = self.ctx.state.instance(address.as_ref())?;
        borrow(&instance.storage as &dyn Storage);

        Ok(())
    }

    /// Returns an `Err` if a contract with `address` wasn't found. In case an error
    /// is returned from the closure, the updates to that storage are discarded.
    pub fn contract_storage_mut<F>(&mut self, address: impl AsRef<str>, mutate: F) -> EnsembleResult<()>
        where F: FnOnce(&mut dyn Storage) -> EnsembleResult<()>
    {
        self.ctx.state.push_scope();
        let result = self.ctx.state.borrow_storage_mut(address.as_ref(), mutate);

        self.ctx.state.commit();

        result
    }

    /// Returned address and code hash correspond to the values in `env`.
    pub fn instantiate<T: Serialize>(
        &mut self,
        info: ContractInstantiationInfo,
        msg: &T,
        env: MockEnv
    ) -> EnsembleResult<InstantiateResponse> {
        let sub_msg = SubMsg::new(WasmMsg::Instantiate {
            code_id: info.id,
            code_hash: info.code_hash,
            msg: to_binary(msg)?,
            funds: env.sent_funds,
            label: env.contract.into_string()
        });

        match self.ctx.execute_messages(sub_msg, env.sender.into_string())? {
            ResponseVariants::Instantiate(resp) => Ok(resp),
            _ => unreachable!()
        }
    }

    /// Executes the contract with the address provided in `env`.
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
    pub fn new(native_denom: String) -> Self {
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
        self.state.transfer_funds(
            sender.clone(),
            address.clone(),
            env.sent_funds.clone()
        )?;

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
        
        self.state.transfer_funds(
            &sender,
            &address,
            msg_info.funds.clone()
        )?;

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
        mut sender: String
    ) -> EnsembleResult<ResponseVariants> {
        let mut state = SubMsgExecState::new(msg);

        while let Some(sub_msg) = state.next() {
            if let Some(latest) = state.latest() {
                sender = latest.address().to_string();
            }

            let reply = sub_msg.reply_on.clone();
            let id = sub_msg.id;

            self.state.push_scope();

            match self.execute_sub_msg(sub_msg, sender.clone()) {
                Ok(resp) => {
                    state.add_response(resp);

                    if matches!(reply, ReplyOn::Always | ReplyOn::Success) {
                        let reply = Reply {
                            id,
                            // TODO: Where should those be coming from?
                            result: SubMsgResult::Ok(SubMsgResponse {
                                events: vec![],
                                data: None
                            })
                        };

                        match self.reply(sender.clone(), reply) {
                            Ok(resp) => {
                                state.add_response(resp.into());
                            },
                            Err(err) => {
                                self.state.revert();

                                return Err(err);
                            }
                        }
                    }
                },
                Err(err) if err.is_contract_error() &&
                    matches!(reply, ReplyOn::Always | ReplyOn::Error) =>
                {
                    self.state.revert_scope();

                    let reply = Reply {
                        id,
                        result: SubMsgResult::Err(err.to_string())
                    };

                    match self.reply(sender.clone(), reply) {
                        Ok(resp) => {
                            state.add_response(resp.into());
                        },
                        Err(err) => {
                            self.state.revert();

                            return Err(err);
                        }
                    }
                },
                Err(err) => {
                    self.state.revert();
                    
                    return Err(err);
                }
            };
        }

        self.block.next();
        self.state.commit();

        Ok(state.finalize())
    }

    fn execute_sub_msg(
        &mut self,
        sub_msg: SubMsg,
        sender: String,
    ) -> EnsembleResult<ResponseVariants> {
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
                        return Err(EnsembleError::InvalidCodeHash(code_hash));
                    }

                    let env = MockEnv::new(
                        sender,
                        contract_addr.clone()
                    ).sent_funds(funds);

                    Ok(self.execute(msg, env)?.into())
                }
                WasmMsg::Instantiate {
                    code_id,
                    msg,
                    funds,
                    label,
                    code_hash,
                } => {
                    let contract = self
                        .contracts
                        .get(code_id as usize)
                        .ok_or_else(|| EnsembleError::ContractIdNotFound(code_id))?;

                    if contract.code_hash != code_hash {
                        return Err(EnsembleError::InvalidCodeHash(code_hash));
                    }

                    let env = MockEnv::new(
                        sender.clone(),
                        label.clone()
                    ).sent_funds(funds);

                    let result = self.instantiate(
                        code_id,
                        msg,
                        env
                    )?;

                    Ok(result.into())
                }
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            }
            CosmosMsg::Bank(msg) => match msg {
                BankMsg::Send {
                    to_address,
                    amount,
                } => {
                    let result = self.state.transfer_funds(
                        &sender,
                        &to_address,
                        amount
                    )?;

                    Ok(result.into())
                },
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            }
            CosmosMsg::Staking(msg) => match msg {
                StakingMsg::Delegate { validator, amount } => {
                    self.state.remove_funds(&sender, vec![amount.clone()])?;

                    let result = self.delegations.delegate(
                        sender.clone(),
                        validator,
                        amount
                    )?;

                    Ok(result.into())
                }
                StakingMsg::Undelegate { validator, amount } => {
                    let result = self.delegations.undelegate(
                        sender.clone(),
                        validator,
                        amount.clone(),
                    )?;

                    Ok(result.into())
                }
                StakingMsg::Redelegate {
                    src_validator,
                    dst_validator,
                    amount,
                } => {
                    let result = self.delegations.redelegate(
                        sender.clone(),
                        src_validator,
                        dst_validator,
                        amount,
                    )?;

                    Ok(result.into())
                },
                _ => panic!("Ensemble: Unsupported message: {:?}", msg)
            },
            CosmosMsg::Distribution(msg) => match msg {
                DistributionMsg::WithdrawDelegatorReward { validator } => {
                    // Query accumulated rewards so bank transaction can take place first
                    let withdraw_amount = match self.delegations.delegation(&sender, &validator) {
                        Some(amount) => amount.accumulated_rewards,
                        None => return Err(EnsembleError::Staking("Delegation not found".into())),
                    };

                    self.state.add_funds(sender.clone(), withdraw_amount);

                    let result = self.delegations.withdraw(sender, validator)?;

                    Ok(result.into())
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
        Env {
            block: BlockInfo {
                height: self.block.height,
                time: Timestamp::from_seconds(self.block.time),
                chain_id: self.chain_id.clone(),
            },
            transaction: None,
            contract: ContractInfo {
                address: contract.address,
                code_hash: contract.code_hash,
            }
        }
    }
}

impl SubMsgExecState {
    #[inline]
    fn new(initial: SubMsg) -> Self {
        Self {
            initial: Some(initial),
            responses: vec![]
        }
    }

    #[inline]
    fn finalize(mut self) -> ResponseVariants {
        assert_eq!(self.responses.len(), 1);

        self.pop()
    }

    #[inline]
    fn latest(&self) -> Option<&ResponseVariants> {
        if let Some(resp) = self.responses.last() {
            Some(&resp.response)
        } else {
            None
        }
    }

    fn add_response(&mut self, response: ResponseVariants) {
        if response.messages().len() > 0 || self.responses.is_empty() {
            self.responses.push(ResponseExecState::new(response));
        } else {
            self.responses.last_mut()
                .unwrap()
                .response
                .add_response(response);
        }
    }

    fn next(&mut self) -> Option<SubMsg> {
        if self.initial.is_some() {
            return self.initial.take();
        }

        while self.responses.len() > 0 {
            let index = self.responses.len() - 1;
            let msg = self.responses[index].next();

            if msg.is_some() {
                return msg;
            }

            if index > 0 {
                let last = self.pop();
                self.responses[index - 1]
                    .response
                    .add_response(last);
            } else {
                break;
            }
        }

        None
    }

    #[inline]
    fn pop(&mut self) -> ResponseVariants {
        self.responses.pop().unwrap().response
    }
}

impl ResponseExecState {
    fn new(response: ResponseVariants) -> Self {
        Self {
            response,
            index: 0
        }
    }

    fn next(&mut self) -> Option<SubMsg> {
        let messages = self.response.messages();

        if self.index < messages.len() {
            let result = Some(messages[self.index].clone());
            self.index += 1;

            result
        } else {
            None
        }
    }
}

impl EnsembleError {
    #[inline]
    pub fn unwrap_contract_error(self) -> anyhow::Error {
        match self {
            Self::ContractError(err) => err,
            _ => panic!("called EnsembleError::unwrap_contract_error() on a non EnsembleError::ContractError")
        }
    }

    #[inline]
    pub fn is_contract_error(&self) -> bool {
        matches!(self, EnsembleError::ContractError(_))
    }
}

impl From<StdError> for EnsembleError {
    fn from(err: StdError) -> Self {
        Self::Std(err)
    }
}

impl From<anyhow::Error> for EnsembleError {
    fn from(err: anyhow::Error) -> Self {
        Self::ContractError(err)
    }
}

impl Display for EnsembleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Bank(msg) => f.write_fmt(format_args!("Ensemble error - Bank: {}", msg)),
            Self::Staking(msg) => f.write_fmt(format_args!("Ensemble error - Staking: {}", msg)),
            Self::ContractNotFound(address) => f.write_fmt(format_args!("Ensemble error - Contract not found: {}", address)),
            Self::ContractDuplicateAddress(address) => f.write_fmt(format_args!("Ensemble error - Contract instance with address {} already exists", address)),
            Self::ContractIdNotFound(id) => f.write_fmt(format_args!("Ensemble error - Contract id not found: {}", id)),
            Self::InvalidCodeHash(hash) => f.write_fmt(format_args!("Ensemble error - Contract code hash is invalid: {}", hash)),
            Self::Std(err) => Display::fmt(err, f),
            Self::ContractError(err) => Display::fmt(err, f)
        }
    }
}

impl Debug for Context {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Context")
            .field("contracts_len", &self.contracts.len())
            .field("delegations", &self.delegations)
            .field("state", &self.state)
            .field("block", &self.block)
            .field("chain_id", &self.chain_id)
            .finish()
    }
}

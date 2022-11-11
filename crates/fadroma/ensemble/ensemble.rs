use std::fmt::Debug;
use serde::{
    Serialize,
    de::DeserializeOwned
};

use crate::{
    prelude::{ContractInstantiationInfo, ContractLink},
    cosmwasm_std::{
        SubMsg, Deps, DepsMut, Env, Response, MessageInfo, Binary, Uint128, Coin, Attribute,
        FullDelegation, Validator, Delegation, CosmosMsg, WasmMsg, BlockInfo, ContractInfo,
        StakingMsg, BankMsg, DistributionMsg, Timestamp, Addr, SubMsgResponse, SubMsgResult,
        Reply, Storage, Api, Querier, QuerierWrapper, Empty, from_binary, to_binary,
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
    state::State,
    execution_state::{ExecutionState, MessageType},
    error::{EnsembleError, RegistryError}
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

        if result.is_ok() {
            self.ctx.state.commit();
        } else {
            self.ctx.state.revert();
        }

        result
    }

    /// Returned address and code hash correspond to the values in `env`.
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

        validate_response(&response)?;

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

        validate_response(&response)?;

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

        validate_response(&response)?;

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
                    match error {
                        Some(err) => {
                            let reply = Reply {
                                id,
                                result: SubMsgResult::Err(err)
                            };

                            self.reply(target, reply).map(|x| x.into())
                        },
                        None => {
                            let reply = Reply {
                                id,
                                // TODO: Where should those be coming from?
                                result: SubMsgResult::Ok(SubMsgResponse {
                                    events: vec![],
                                    data: None
                                })
                            };

                            self.reply(target, reply).map(|x| x.into())
                        }
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
                        return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
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
                        .ok_or_else(|| EnsembleError::registry(RegistryError::IdNotFound(code_id)))?;

                    if contract.code_hash != code_hash {
                        return Err(EnsembleError::registry(RegistryError::InvalidCodeHash(code_hash)));
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

// Taken from https://github.com/CosmWasm/cw-multi-test/blob/03026ccd626f57869c57c9192a03da6625e4791d/src/wasm.rs#L231-L268
fn validate_response(response: &Response) -> EnsembleResult<()> {
    validate_attributes(&response.attributes)?;

    for event in &response.events {
        validate_attributes(&event.attributes)?;
        let ty = event.ty.trim();
        
        if ty.len() < 2 {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute type cannot be less than 2 characters: {}", ty)
            ));
        }
    }

    Ok(())
}

fn validate_attributes(attributes: &[Attribute]) -> EnsembleResult<()> {
    for attr in attributes {
        let key = attr.key.trim();
        let val = attr.value.trim();

        if key.is_empty() {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute key for value {} cannot be empty", val)
            ));
        }

        if val.is_empty() {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute value with key {} cannot be empty", key)
            ));
        }

        if key.starts_with('_') {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute key {} cannot start with \"_\"", key)
            ));
        }
    }

    Ok(())
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

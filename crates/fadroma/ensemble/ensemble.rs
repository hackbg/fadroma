use std::{
    collections::HashMap,
    marker::PhantomData,
    fmt::{Debug, Display}
};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::{
    prelude::{ContractInstantiationInfo, ContractLink},
    cosmwasm_std::{
        SubMsg, OwnedDeps, Env, StdError, Response, MessageInfo, Binary, Uint128, Coin,
        FullDelegation, Validator, Delegation, CosmosMsg, WasmMsg, BlockInfo, ContractInfo,
        StakingMsg, BankMsg, DistributionMsg, Timestamp, Addr, Reply, ReplyOn, SubMsgResult,
        SubMsgResponse, from_binary, to_binary,
        testing::MockApi
    }
};

use super::{
    bank::{Balances, Bank},
    block::Block,
    env::MockEnv,
    querier::EnsembleQuerier,
    response::{ExecuteResponse, InstantiateResponse, ResponseVariants},
    revertable::Revertable,
    staking::Delegations,
    storage::TestStorage,
};

pub type AnyResult<T> = anyhow::Result<T>;
pub type EnsembleResult<T> = core::result::Result<T, EnsembleError>;
pub type MockDeps = OwnedDeps<Revertable<TestStorage>, MockApi, EnsembleQuerier>;

pub trait ContractHarness {
    fn instantiate(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn execute(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> AnyResult<Response>;

    fn query(&self, deps: &MockDeps, env: Env, msg: Binary) -> AnyResult<Binary>;

    fn reply(&self, _deps: &mut MockDeps, _env: Env, _reply: Reply) -> AnyResult<Response> {
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
    pub instances: HashMap<String, ContractInstance>,
    pub contracts: Vec<Box<dyn ContractHarness>>,
    pub bank: Revertable<Bank>,
    pub delegations: Delegations,
    block: Block,
    chain_id: String
}

pub(crate) struct ContractInstance {
    pub deps: MockDeps,
    code_hash: String,
    index: usize
}

impl ContractEnsemble {
    pub fn new() -> Self {
        Self {
            ctx: Box::new(Context::new("uscrt".into())),
        }
    }

    pub fn new_with_denom(native_denom: impl Into<String>) -> Self {
        Self {
            ctx: Box::new(Context::new(native_denom.into())),
        }
    }

    pub fn register(&mut self, harness: Box<dyn ContractHarness>) -> ContractInstantiationInfo {
        self.ctx.contracts.push(harness);
        let id = (self.ctx.contracts.len() - 1) as u64;

        ContractInstantiationInfo {
            id,
            code_hash: format!("test_contract_{}", id)
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
        self.ctx.bank.current.add_funds(address.as_ref(), coins);
    }

    #[inline]
    pub fn remove_funds(&mut self, address: impl AsRef<str>, coins: Vec<Coin>) -> EnsembleResult<()> {
        self.ctx.bank.current.remove_funds(address.as_ref(), coins)
    }

    #[inline]
    pub fn balances(&self, address: impl AsRef<str>) -> Option<&Balances> {
        self.ctx.bank.current.0.get(address.as_ref())
    }

    #[inline]
    pub fn balances_mut(&mut self, address: impl AsRef<str>) -> Option<&mut Balances> {
        self.ctx.bank.current.0.get_mut(address.as_ref())
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

    #[inline]
    /// Re-allow redelegating and deposit unbondings
    pub fn fast_forward_delegation_waits(&mut self) {
        let unbondings = self.ctx.delegations.fast_forward_waits();

        for unbonding in unbondings {
            self.ctx
                .bank
                .current
                .add_funds(
                    unbonding.delegator.as_str(),
                    vec![unbonding.amount]
                );
        }
    }

    // Returning a Result here is most flexible and requires the caller to assert that
    // their closure was called, as it is really unlikely that they call this function
    // with an address they know doesn't exist. And we don't want to fail silently if
    // a non-existent address is provided. So returning nothing or bool is bad here.

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps<F>(&self, address: impl AsRef<str>, borrow: F) -> EnsembleResult<()>
    where
        F: FnOnce(&MockDeps),
    {
        let address = address.as_ref();

        if let Some(instance) = self.ctx.instances.get(address) {
            borrow(&instance.deps);

            return Ok(());
        }

        Err(EnsembleError::ContractNotFound(address.into()))
    }

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps_mut<F>(&mut self, address: impl AsRef<str>, mutate: F) -> EnsembleResult<()>
    where
        F: FnOnce(&mut MockDeps),
    {
        let address = address.as_ref();

        if let Some(instance) = self.ctx.instances.get_mut(address) {
            mutate(&mut instance.deps);

            instance.deps.storage.commit();

            return Ok(());
        }

        Err(EnsembleError::ContractNotFound(address.into()))
    }

    /// Returned address and code hash correspond to the values in `env`.
    pub fn instantiate<T: Serialize>(
        &mut self,
        info: ContractInstantiationInfo,
        msg: &T,
        env: MockEnv
    ) -> EnsembleResult<InstantiateResponse> {
        let result = self.ctx.instantiate(info, to_binary(msg)?, env);

        if result.is_ok() {
            self.ctx.commit();
            self.ctx.block.next();
        } else {
            self.ctx.revert();
        }

        result
    }

    /// Executes the contract with the address provided in `env`.
    pub fn execute<T: Serialize + ?Sized>(
        &mut self,
        msg: &T,
        env: MockEnv
    ) -> EnsembleResult<ExecuteResponse> {
        let result = self.ctx.execute(to_binary(msg)?, env);

        if result.is_ok() {
            self.ctx.commit();
            self.ctx.block.next();
        } else {
            self.ctx.revert();
        }

        result
    }

    #[inline]
    pub fn query<T: Serialize + ?Sized, R: DeserializeOwned>(
        &self,
        address: impl AsRef<str>,
        msg: &T
    ) -> EnsembleResult<R> {
        let result = self.ctx.query(address.as_ref(), to_binary(msg)?)?;
        let result = from_binary(&result)?;

        Ok(result)
    }
}

impl ContractInstance {
    fn new(info: ContractInstantiationInfo, ctx: &Context) -> Self {
        Self {
            deps: OwnedDeps {
                storage: Revertable::<TestStorage>::default(),
                api: MockApi::default(),
                querier: EnsembleQuerier::new(ctx),
                custom_query_type: PhantomData,
            },
            code_hash: info.code_hash,
            index: info.id as usize
        }
    }

    #[inline]
    fn commit(&mut self) {
        self.deps.storage.commit();
    }

    #[inline]
    fn revert(&mut self) {
        self.deps.storage.revert();
    }
}

impl Context {
    pub fn new(native_denom: String) -> Self {
        Self {
            bank: Default::default(),
            contracts: Default::default(),
            instances: Default::default(),
            delegations: Delegations::new(native_denom),
            block: Block::default(),
            chain_id: "fadroma-ensemble-testnet".into(),
        }
    }

    fn instantiate(
        &mut self,
        info: ContractInstantiationInfo,
        msg: Binary,
        env: MockEnv,
    ) -> EnsembleResult<InstantiateResponse> {
        let contract = self
            .contracts
            .get(info.id as usize)
            .ok_or_else(|| EnsembleError::ContractIdNotFound(info.id))?;

        let address = env.contract.to_string();
        let code_hash = info.code_hash.clone();

        let instance = ContractInstance::new(info, &self);

        if self.instances.contains_key(&address) {
            return Err(EnsembleError::ContractDuplicateAddress(address));
        }

        self.bank.writable().transfer(
            env.sender.as_str(),
            env.contract.as_str(),
            env.sent_funds.clone(),
        )?;
        self.instances.insert(address.clone(), instance);

        let (env, msg_info) = self.create_msg_deps(
            env,
            code_hash.clone()
        );
        let sender = msg_info.sender.to_string();

        let instance = self.instances
            .get_mut(&address)
            .ok_or_else(|| EnsembleError::ContractNotFound(address.to_string()))?;

        let result = contract.instantiate(&mut instance.deps, env, msg_info, msg.clone());

        match result {
            Ok(msgs) => {
                let result = self.execute_messages(
                    msgs.messages.clone(),
                    address.clone()
                );

                match result {
                    Ok(sent) => Ok(InstantiateResponse {
                        sender,
                        instance: ContractLink {
                            address: Addr::unchecked(address),
                            code_hash
                        },
                        msg,
                        response: msgs,
                        sent,
                    }),
                    Err(err) => {
                        self.instances.remove(&address);

                        Err(EnsembleError::from(err))
                    }
                }
            }
            Err(err) => {
                self.instances.remove(&address);

                Err(EnsembleError::from(err))
            }
        }
    }

    fn execute(&mut self, msg: Binary, env: MockEnv) -> EnsembleResult<ExecuteResponse> {
        let address = env.contract.to_string();
        let code_hash = self.instances
            .get(&address)
            .ok_or_else(|| EnsembleError::ContractNotFound(address.to_string()))?
            .code_hash
            .clone();

        let (env, msg_info) = self.create_msg_deps(env, code_hash);
        let sender = msg_info.sender.to_string();
        
        self.bank.writable()
            .transfer(
                &sender,
                &address,
                msg_info.funds.clone()
            )?;

        let instance = self.instances
            .get_mut(&address)
            .unwrap();

        let contract = &self.contracts[instance.index];
        let result = contract.execute(&mut instance.deps, env, msg_info, msg.clone())?;

        let sent = self.execute_messages(result.messages.clone(), address.clone())?;

        Ok(ExecuteResponse {
            sender,
            target: address,
            msg,
            response: result,
            sent,
        })
    }

    pub(crate) fn query(&self, address: &str, msg: Binary) -> EnsembleResult<Binary> {
        let instance = self
            .instances
            .get(address)
            .ok_or_else(|| EnsembleError::ContractNotFound(address.into()))?;

        let contract = &self.contracts[instance.index];
        let env = self.create_env(ContractLink {
            address: Addr::unchecked(address),
            code_hash: instance.code_hash.clone()
        });

        let result = contract.query(&instance.deps, env, msg)?;

        Ok(result)
    }

    fn execute_messages(
        &mut self,
        messages: Vec<SubMsg>,
        sender: String,
    ) -> EnsembleResult<Vec<ResponseVariants>> {
        let mut responses = vec![];

        for sub_msg in messages {
            match sub_msg.msg {
                CosmosMsg::Wasm(msg) => match msg {
                    WasmMsg::Execute {
                        contract_addr,
                        msg,
                        funds,
                        code_hash,
                    } => {
                        let instance = self.instances.get(&contract_addr)
                            .ok_or_else(|| EnsembleError::ContractNotFound(contract_addr.to_string()))?;

                        if instance.code_hash != code_hash {
                            return Err(EnsembleError::InvalidCodeHash(code_hash));
                        }

                        let env = MockEnv::new(sender.clone(), contract_addr)
                            .sent_funds(funds);

                        responses.push(ResponseVariants::Execute(self.execute(msg, env)?));
                    }
                    WasmMsg::Instantiate {
                        code_id,
                        msg,
                        funds,
                        label,
                        code_hash,
                    } => {
                        let env = MockEnv::new(sender.clone(), label)
                            .sent_funds(funds);

                        responses.push(ResponseVariants::Instantiate(self.instantiate(
                            ContractInstantiationInfo {
                                code_hash,
                                id: code_id
                            },
                            msg,
                            env,
                        )?));
                    }
                    _ => panic!("Ensemble: Unsupported message: {:?}", msg)
                }
                CosmosMsg::Bank(msg) => match msg {
                    BankMsg::Send {
                        to_address,
                        amount,
                    } => {
                        let res = self.bank
                            .writable()
                            .transfer(
                                &sender,
                                &to_address,
                                amount
                            )?;

                        responses.push(ResponseVariants::Bank(res));
                    },
                    _ => panic!("Ensemble: Unsupported message: {:?}", msg)
                }
                CosmosMsg::Staking(msg) => match msg {
                    StakingMsg::Delegate { validator, amount } => {
                        self.bank
                            .writable()
                            .remove_funds(&sender, vec![amount.clone()])?;

                        let res = self.delegations.delegate(
                            sender.clone(),
                            validator,
                            amount
                        );

                        if res.is_err() {
                            self.bank.revert();
                        }

                        responses.push(ResponseVariants::Staking(res?));
                    }
                    StakingMsg::Undelegate { validator, amount } => {
                        let res = self.delegations.undelegate(
                            sender.clone(),
                            validator,
                            amount.clone(),
                        )?;

                        responses.push(ResponseVariants::Staking(res));
                    }
                    StakingMsg::Redelegate {
                        src_validator,
                        dst_validator,
                        amount,
                    } => {
                        let res = self.delegations.redelegate(
                            sender.clone(),
                            src_validator,
                            dst_validator,
                            amount,
                        )?;

                        responses.push(ResponseVariants::Staking(res));
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

                        self.bank
                            .writable()
                            .add_funds(&sender, withdraw_amount);

                        let withdraw_res = self.delegations.withdraw(sender.clone(), validator)?;

                        responses.push(ResponseVariants::Staking(withdraw_res));
                    },
                    _ => unimplemented!()
                }
                _ => panic!("Ensemble: Unsupported message: {:?}", sub_msg)
            }
        }

        Ok(responses)
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

    fn commit(&mut self) {
        for instance in self.instances.values_mut() {
            instance.commit();
        }

        self.bank.commit();
    }

    fn revert(&mut self) {
        for instance in self.instances.values_mut() {
            instance.revert();
        }

        self.bank.revert();
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
            .field("instances", &self.instances)
            .field("contracts_len", &self.contracts.len())
            .field("bank", &self.bank)
            .finish()
    }
}

impl Debug for ContractInstance {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ContractInstance")
            .field("storage", &self.deps.storage)
            .field("index", &self.index)
            .finish()
    }
}

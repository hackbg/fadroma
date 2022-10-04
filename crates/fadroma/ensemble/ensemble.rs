use std::{
    collections::HashMap,
    marker::PhantomData,
    fmt::Debug
};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::{
    prelude::{ContractInstantiationInfo, ContractLink},
    cosmwasm_std::{
        SubMsg, OwnedDeps, Env, StdResult, StdError, Response, MessageInfo, Binary,
        Uint128, Coin, FullDelegation, Validator, Delegation, CosmosMsg, WasmMsg,
        BlockInfo, ContractInfo, StakingMsg, BankMsg, DistributionMsg, Timestamp,
        Addr, from_binary, to_binary,
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

pub type MockDeps = OwnedDeps<Revertable<TestStorage>, MockApi, EnsembleQuerier>;

pub trait ContractHarness {
    fn instantiate(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> StdResult<Response>;

    fn execute(&self, deps: &mut MockDeps, env: Env, info: MessageInfo, msg: Binary) -> StdResult<Response>;

    fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary>;
}

#[derive(Debug)]
pub struct ContractEnsemble {
    // NOTE: Box required to ensure the pointer address remains the same and the raw pointer in EnsembleQuerier is safe to dereference.
    pub(crate) ctx: Box<Context>
}

pub(crate) struct Context {
    pub(crate) instances: HashMap<String, ContractInstance>,
    pub(crate) contracts: Vec<Box<dyn ContractHarness>>,
    pub(crate) bank: Revertable<Bank>,
    pub(crate) delegations: Delegations,
    block: Block,
    chain_id: String
}

pub(crate) struct ContractInstance {
    pub(crate) deps: MockDeps,
    index: usize,
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
            code_hash: format!("test_contract_{}", id),
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
    pub fn remove_funds(&mut self, address: impl AsRef<str>, coins: Vec<Coin>) -> StdResult<()> {
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
    pub fn deps<F>(&self, address: impl AsRef<str>, borrow: F) -> Result<(), String>
    where
        F: FnOnce(&MockDeps),
    {
        let address = address.as_ref();

        if let Some(instance) = self.ctx.instances.get(address) {
            borrow(&instance.deps);

            return Ok(());
        }

        Err(format!("Contract not found: {}", address))
    }

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps_mut<F>(&mut self, address: impl AsRef<str>, mutate: F) -> Result<(), String>
    where
        F: FnOnce(&mut MockDeps),
    {
        let address = address.as_ref();

        if let Some(instance) = self.ctx.instances.get_mut(address) {
            mutate(&mut instance.deps);

            instance.deps.storage.commit();

            return Ok(());
        }

        Err(format!("Contract not found: {}", address))
    }

    /// Returned address and code hash correspond to the values in `env`.
    pub fn instantiate<T: Serialize>(
        &mut self,
        id: u64,
        msg: &T,
        env: MockEnv,
    ) -> StdResult<InstantiateResponse> {
        let result = self.ctx.instantiate(id as usize, to_binary(msg)?, env);

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
        env: MockEnv,
    ) -> StdResult<ExecuteResponse> {
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
        msg: &T,
    ) -> StdResult<R> {
        let result = self.ctx.query(address.as_ref(), to_binary(msg)?)?;

        from_binary(&result)
    }
}

impl ContractInstance {
    fn new(index: usize, ctx: &Context) -> Self {
        Self {
            deps: OwnedDeps {
                storage: Revertable::<TestStorage>::default(),
                api: MockApi::default(),
                querier: EnsembleQuerier::new(ctx),
                custom_query_type: PhantomData,
            },
            index,
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
        id: usize,
        msg: Binary,
        env: MockEnv,
    ) -> StdResult<InstantiateResponse> {
        let contract = self
            .contracts
            .get(id)
            .expect(&format!("Contract with id \"{}\" doesn't exist.", id));

        let instance = ContractInstance::new(id, &self);

        let contract_info = env.contract.clone();
        if self.instances.contains_key(contract_info.address.as_str()) {
            panic!(
                "Trying to instantiate an already existing address: {}.",
                contract_info.address
            )
        }

        self.bank.writable().transfer(
            env.sender.as_str(),
            contract_info.address.as_str(),
            env.sent_funds.clone(),
        )?;
        self.instances.insert(contract_info.address.to_string(), instance);

        let (env, msg_info) = self.create_msg_deps(env);
        let sender = msg_info.sender.clone();

        let instance = self.instances.get_mut(contract_info.address.as_str()).unwrap();
        let result = contract.instantiate(&mut instance.deps, env, msg_info, msg.clone());

        match result {
            Ok(msgs) => {
                let result = self.execute_messages(
                    msgs.messages.clone(),
                    contract_info.address.clone()
                );

                match result {
                    Ok(sent) => Ok(InstantiateResponse {
                        sender: sender.into_string(),
                        instance: contract_info,
                        msg,
                        response: msgs,
                        sent,
                    }),
                    Err(err) => {
                        self.instances.remove(contract_info.address.as_str());

                        Err(err)
                    }
                }
            }
            Err(err) => {
                self.instances.remove(contract_info.address.as_str());

                Err(err)
            }
        }
    }

    fn execute(&mut self, msg: Binary, env: MockEnv) -> StdResult<ExecuteResponse> {
        let address = env.contract.address.clone();
        let (env, msg_info) = self.create_msg_deps(env);
        let sender = msg_info.sender.clone();

        let instance = self
            .instances
            .get_mut(address.as_str())
            .expect(&format!("Contract address doesn't exist: {}", address));

        self.bank.writable()
            .transfer(
                sender.as_str(),
                address.as_str(),
                msg_info.funds.clone()
            )?;

        let contract = self.contracts.get(instance.index).unwrap();

        let result = contract.execute(&mut instance.deps, env, msg_info, msg.clone())?;

        let sent = self.execute_messages(result.messages.clone(), address.clone())?;

        let res = ExecuteResponse {
            sender: sender.into_string(),
            target: address.into_string(),
            msg,
            response: result,
            sent,
        };

        Ok(res)
    }

    pub(crate) fn query(&self, address: &str, msg: Binary) -> StdResult<Binary> {
        let instance = self
            .instances
            .get(address)
            .expect(&format!("Contract address doesn't exist: {}", address));

        let contract = self.contracts.get(instance.index).unwrap();

        contract.query(&instance.deps, msg)
    }

    fn execute_messages(
        &mut self,
        messages: Vec<SubMsg>,
        sender: Addr,
    ) -> StdResult<Vec<ResponseVariants>> {
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
                        let env = MockEnv::new(
                            sender.clone(),
                            ContractLink {
                                address: Addr::unchecked(contract_addr),
                                code_hash,
                            },
                        )
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
                        let env = MockEnv::new(
                            sender.clone(),
                            ContractLink {
                                address: Addr::unchecked(label),
                                code_hash,
                            },
                        )
                        .sent_funds(funds);

                        responses.push(ResponseVariants::Instantiate(self.instantiate(
                            code_id as usize,
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
                                sender.as_str(),
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
                            .remove_funds(sender.as_str(), vec![amount.clone()])?;

                        let res = self.delegations.delegate(
                            sender.to_string(),
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
                            sender.to_string(),
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
                            sender.to_string(),
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
                        let withdraw_amount = match self.delegations.delegation(sender.as_str(), &validator) {
                            Some(amount) => amount.accumulated_rewards,
                            None => return Err(StdError::generic_err("Delegation not found")),
                        };

                        self.bank
                            .writable()
                            .add_funds(sender.as_str(), withdraw_amount);

                        let withdraw_res = self.delegations.withdraw(sender.to_string(), validator)?;

                        responses.push(ResponseVariants::Staking(withdraw_res));
                    },
                    _ => unimplemented!()
                }
                _ => panic!("Ensemble: Unsupported message: {:?}", sub_msg)
            }
        }

        Ok(responses)
    }

    fn create_msg_deps(&self, env: MockEnv) -> (Env, MessageInfo) {
        (Env {
            block: BlockInfo {
                height: self.block.height,
                time: Timestamp::from_seconds(self.block.time),
                chain_id: self.chain_id.clone(),
            },
            transaction: None,
            contract: ContractInfo {
                address: env.contract.address,
                code_hash: env.contract.code_hash,
            },
        },
        MessageInfo {
            sender: env.sender,
            funds: env.sent_funds
        })
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

use crate::prelude::{*, testing::MockApi};
use std::collections::HashMap;
use std::fmt::Debug;
use serde::de::DeserializeOwned;
use serde::Serialize;
use super::{
    bank::{Balances, Bank},
    env::MockEnv,
    querier::EnsembleQuerier,
    revertable::Revertable,
    storage::TestStorage,
    block::Block,
    response::{Response, InstantiateResponse, ExecuteResponse},
    staking::Delegations,
};

pub type MockDeps = Extern<Revertable<TestStorage>, MockApi, EnsembleQuerier>;

pub trait ContractHarness {
    fn init(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<InitResponse>;

    fn handle(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<HandleResponse>;

    fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary>;
}

#[derive(Debug)]
pub struct ContractEnsemble {
    // NOTE: Box required to ensure the pointer address remains the same and the raw pointer in EnsembleQuerier is safe to dereference.
    pub(crate) ctx: Box<Context>,
}

pub(crate) struct Context {
    pub(crate) instances: HashMap<HumanAddr, ContractInstance>,
    pub(crate) contracts: Vec<Box<dyn ContractHarness>>,
    pub(crate) bank: Revertable<Bank>,
    pub(crate) delegations: Delegations,
    block: Block,
    chain_id: String,
    canonical_length: usize,
}

pub(crate) struct ContractInstance {
    pub(crate) deps: MockDeps,
    index: usize
}

impl ContractEnsemble {
    pub fn new(canonical_length: usize) -> Self {
        Self {
            ctx: Box::new(Context::new(canonical_length, "uscrt".into())),
        }
    }

    pub fn new_denom(canonical_length: usize, native_denom: String) -> Self {
        Self {
            ctx: Box::new(Context::new(canonical_length, native_denom)),
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
    pub fn add_funds(&mut self, address: impl Into<HumanAddr>, coins: Vec<Coin>) {
        self.ctx.bank.current.add_funds(&address.into(), coins);
    }

    #[inline]
    pub fn balances(&self, address: impl Into<HumanAddr>) -> Option<&Balances> {
        self.ctx.bank.current.0.get(&address.into())
    }

    #[inline]
    pub fn balances_mut(&mut self, address: impl Into<HumanAddr>) -> Option<&mut Balances> {
        self.ctx.bank.current.0.get_mut(&address.into())
    }

    #[inline]
    pub fn add_validator(&mut self, validator: Validator) {
        self.ctx.delegations.add_validator(validator);
    }

    // Returning a Result here is most flexible and requires the caller to assert that
    // their closure was called, as it is really unlikely that they call this function
    // with an address they know doesn't exist. And we don't want to fail silently if
    // a non-existent address is provided. So returning nothing or bool is bad here.

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps<F>(&self, address: impl Into<HumanAddr>, borrow: F) -> Result<(), String>
    where
        F: FnOnce(&MockDeps),
    {
        let address = address.into();

        if let Some(instance) = self.ctx.instances.get(&address) {
            borrow(&instance.deps);

            return Ok(());
        }


        Err(format!("Contract not found: {}", address))
    }

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps_mut<F>(&mut self, address: impl Into<HumanAddr>, mutate: F) -> Result<(), String>
    where
        F: FnOnce(&mut MockDeps),
    {
        let address = address.into();

        if let Some(instance) = self.ctx.instances.get_mut(&address) {
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
        env: MockEnv
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
        address: impl Into<HumanAddr>,
        msg: &T,
    ) -> StdResult<R> {
        let result = self.ctx.query(address.into(), to_binary(msg)?)?;

        from_binary(&result)
    }
}

impl ContractInstance {
    fn new(index: usize, canonical_length: usize, ctx: &Context) -> Self {
        Self {
            deps: Extern {
                storage: Revertable::<TestStorage>::default(),
                api: MockApi::new(canonical_length),
                querier: EnsembleQuerier::new(ctx),
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
    pub fn new(canonical_length: usize, native_denom: String) -> Self {
        Self {
            canonical_length,
            bank: Default::default(),
            contracts: Default::default(),
            instances: Default::default(),
            delegations: Delegations::new(native_denom),
            block: Block::default(),
            chain_id: "fadroma-ensemble-testnet".into()
        }
    }

    fn instantiate(
        &mut self,
        id: usize,
        msg: Binary,
        env: MockEnv,
    ) -> StdResult<InstantiateResponse> {
        let contract = self.contracts
            .get(id)
            .expect(&format!("Contract with id \"{}\" doesn't exist.", id));

        let instance = ContractInstance::new(id, self.canonical_length, &self);

        let contract_info = env.contract.clone();
        if self.instances.contains_key(&contract_info.address) {
            panic!(
                "Trying to instantiate an already existing address: {}.",
                contract_info.address
            )
        }

        self.bank.writable().transfer(
            &env.sender,
            &contract_info.address,
            env.sent_funds.clone(),
        )?;
        self.instances.insert(contract_info.address.clone(), instance);

        let env = self.create_env(env);
        let sender = env.message.sender.clone();

        let instance = self.instances.get_mut(&contract_info.address).unwrap();

        let result = contract.init(&mut instance.deps, env, msg.clone());

        match result {
            Ok(msgs) => {
                let result = self.execute_messages(msgs.messages.clone(), contract_info.address.clone());

                match result {
                    Ok(sent) => {
                        Ok(InstantiateResponse {
                            sender,
                            instance: contract_info,
                            msg,
                            response: msgs,
                            sent
                        })
                    }
                    Err(err) => {
                        self.instances.remove(&contract_info.address);

                        Err(err)
                    }
                }
            }
            Err(err) => {
                self.instances.remove(&contract_info.address);

                Err(err)
            }
        }
    }

    fn execute(&mut self, msg: Binary, env: MockEnv) -> StdResult<ExecuteResponse> {
        let address = env.contract.address.clone();
        let env = self.create_env(env);
        let sender = env.message.sender.clone();

        let instance = self
            .instances
            .get_mut(&address)
            .expect(&format!("Contract address doesn't exist: {}", address));

        self.bank.writable().transfer(
            &sender,
            &address,
            env.message.sent_funds.clone(),
        )?;

        let contract = self.contracts.get(instance.index).unwrap();

        let result = contract.handle(&mut instance.deps, env, msg.clone())?;

        let sent = self.execute_messages(result.messages.clone(), address.clone())?;

        let res = ExecuteResponse {
            sender,
            target: address,
            msg,
            response: result,
            sent
        };

        Ok(res)
    }

    pub(crate) fn query(&self, address: HumanAddr, msg: Binary) -> StdResult<Binary> {
        let instance = self
            .instances
            .get(&address)
            .expect(&format!("Contract address doesn't exist: {}", address));

        let contract = self.contracts.get(instance.index).unwrap();

        contract.query(&instance.deps, msg)
    }

    fn execute_messages(
        &mut self,
        messages: Vec<CosmosMsg>,
        sender: HumanAddr
    ) -> StdResult<Vec<Response>> {
        let mut responses = vec![];

        for msg in messages {
            match msg {
                CosmosMsg::Wasm(msg) => match msg {
                    WasmMsg::Execute {
                        contract_addr,
                        msg,
                        send,
                        callback_code_hash,
                    } => {
                        let env = MockEnv::new(
                            sender.clone(),
                            ContractLink {
                                address: contract_addr,
                                code_hash: callback_code_hash,
                            },
                        )
                        .sent_funds(send);

                        responses.push(Response::Execute(
                            self.execute(msg, env)?
                        ));
                    }
                    WasmMsg::Instantiate {
                        code_id,
                        msg,
                        send,
                        label,
                        callback_code_hash,
                    } => {
                        let env = MockEnv::new(
                            sender.clone(),
                            ContractLink {
                                address: label.into(),
                                code_hash: callback_code_hash,
                            },
                        )
                        .sent_funds(send);

                        responses.push(Response::Instantiate(
                            self.instantiate(code_id as usize, msg, env)?
                        ));
                    }
                },
                CosmosMsg::Bank(msg) => match msg {
                    BankMsg::Send {
                        from_address,
                        to_address,
                        amount,
                    } => {
                        let res = self.bank
                            .writable()
                            .transfer(&from_address, &to_address, amount)?;

                        responses.push(Response::Bank(res));
                    }
                },
                CosmosMsg::Staking(msg) => match msg {
                    StakingMsg::Delegate {
                        validator,
                        amount,
                    } => {
                        let res = self.delegations.delegate(
                            sender.clone(),
                            validator,
                            amount,
                        )?;

                        responses.push(Response::Staking(res));
                    }, 
                    StakingMsg::Undelegate {
                        validator,
                        amount,
                    } => {
                        let res = self.delegations.undelegate(
                            sender.clone(),
                            validator,
                            amount,
                        )?;

                        responses.push(Response::Staking(res));
                    },
                    StakingMsg::Withdraw {
                        validator,
                        recipient,
                    } => {
                        // Query accumulated rewards to bank transaction can take place first
                        let withdraw_amount = match self.delegations.delegation(
                            sender.clone(),
                            validator.clone(),
                        ) {
                            Some(amount) => amount.accumulated_rewards,
                            None => return Err(StdError::generic_err("Delegation not found")),
                        };
                        
                        let funds_recipient = match recipient {
                            Some(recipient) => recipient,
                            None => sender.clone(),
                        };

                        let bank_res = self.bank.writable()
                            .add_funds(&funds_recipient, vec![withdraw_amount]);
                        let withdraw_res = self.delegations.withdraw(
                            sender.clone(),
                            validator,
                        )?;

                        responses.push(Response::Staking(withdraw_res));
                    },
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

                        responses.push(Response::Staking(res));
                    },
                }, 
                _ => panic!("Unsupported message: {:?}", msg),
            }
        }

        Ok(responses)
    }

    fn create_env(&self, env: MockEnv) -> Env {
        Env {
            block: BlockInfo {
                height: self.block.height,
                time: self.block.time,
                chain_id: self.chain_id.clone()
            },
            message: MessageInfo {
                sender: env.sender,
                sent_funds: env.sent_funds
            },
            contract: ContractInfo { address: env.contract.address },
            contract_code_hash: env.contract.code_hash,
            // TODO: add support for this
            contract_key: Some("".into())
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

impl Debug for Context {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Context")
            .field("instances", &self.instances)
            .field("contracts_len", &self.contracts.len())
            .field("canonical_length", &self.canonical_length)
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

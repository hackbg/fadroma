use std::collections::HashMap;
use std::fmt::Debug;

use fadroma_platform_scrt::{
    Extern, Env, StdResult, InitResponse, Coin,
    HandleResponse, Binary, HumanAddr, CosmosMsg,
    WasmMsg, BlockInfo, to_binary, from_binary,
    BankMsg,
    ContractLink, ContractInstantiationInfo,
    testing::MockApi
};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::env::MockEnv;
use crate::querier::EnsembleQuerier;
use crate::revertable::Revertable;
use crate::storage::TestStorage;
use crate::bank::{Bank, Balances};

pub type MockDeps = Extern<Revertable<TestStorage>, MockApi, EnsembleQuerier>;

pub trait ContractHarness {
    fn init(
        &self,
        deps: &mut MockDeps,
        env: Env,
        msg: Binary
    ) -> StdResult<InitResponse>;

    fn handle(
        &self,
        deps: &mut MockDeps,
        env: Env,
        msg: Binary
    ) -> StdResult<HandleResponse>;

    fn query(
        &self,
        deps: &MockDeps,
        msg: Binary
    ) -> StdResult<Binary>;
}

#[derive(Debug)]
pub struct ContractEnsemble {
    pub(crate) ctx: Box<Context>
}

pub(crate) struct Context {
    pub(crate) instances: HashMap<HumanAddr, ContractInstance>,
    pub(crate) contracts: Vec<Box<dyn ContractHarness>>,
    pub(crate) bank: Revertable<Bank>,
    canonical_length: usize
}

pub(crate) struct ContractInstance {
    pub(crate) deps: MockDeps,
    index: usize
    // TODO: should maybe store env.contract_key here
}

impl ContractEnsemble {
    pub fn new(canonical_length: usize) -> Self {
        Self {
            ctx: Box::new(Context::new(canonical_length))
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

    pub fn add_funds(&mut self, address: impl Into<HumanAddr>, coins: Vec<Coin>) {
        self.ctx.bank.current.add_funds(&address.into(), coins);
    }

    pub fn balances(&self, address: impl Into<HumanAddr>) -> Option<&Balances> {
        self.ctx.bank.current.0.get(&address.into())
    }

    pub fn balances_mut(&mut self, address: impl Into<HumanAddr>) -> Option<&mut Balances> {
        self.ctx.bank.current.0.get_mut(&address.into())
    }

    // Returning a Result here is most flexible and requires the caller to assert that
    // their closure was called, as it is really unlikely that they call this function
    // with an address they know doesn't exist. And we don't want to fail silently if
    // a non-existent address is provided. So returning nothing or bool is bad here.

    /// Returns an `Err` if the contract with `address` wasn't found.
    pub fn deps<F>(&self, address: impl Into<HumanAddr>, borrow: F) -> Result<(), String>
        where F: FnOnce(&MockDeps)
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
        where F: FnOnce(&mut MockDeps)
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
        env: MockEnv
    ) -> StdResult<ContractLink<HumanAddr>> {
        let result = self.ctx.instantiate(id as usize, to_binary(msg)?, env);

        if result.is_ok() {
            self.ctx.commit();
        } else {
            self.ctx.revert();
        }

        result
    }

    /// Executes the contract with the address in `env.contract.address`.
    pub fn execute<T: Serialize>(
        &mut self,
        msg: &T,
        env: MockEnv
    ) -> StdResult<()> {
        let result = self.ctx.execute(to_binary(msg)?, env);

        if result.is_ok() {
            self.ctx.commit();
        } else {
            self.ctx.revert();
        }

        result
    }

    #[inline]
    pub fn query<T: Serialize, R: DeserializeOwned>(
        &self,
        address: impl Into<HumanAddr>,
        msg: T
    ) -> StdResult<R> {
        let result = self.ctx.query(address.into(), to_binary(&msg)?)?;

        from_binary(&result)
    }
}

impl ContractInstance {
    fn new(index: usize, canonical_length: usize, ctx: &Context) -> Self {
        Self {
            deps: Extern {
                storage: Revertable::<TestStorage>::default(),
                api: MockApi::new(canonical_length),
                querier: EnsembleQuerier::new(ctx)
            },
            index
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
    pub fn new(canonical_length: usize) -> Self {
        Self {
            canonical_length,
            bank: Default::default(),
            contracts: Default::default(),
            instances: Default::default()
        }
    }

    fn instantiate(
        &mut self,
        id: usize,
        msg: Binary,
        env: MockEnv
    ) -> StdResult<ContractLink<HumanAddr>> {
        let contract = self.contracts.get(id).expect("Contract id doesn't exist.");

        let address = env.0.contract.address.clone();
        let code_hash = env.0.contract_code_hash.clone();
        let block = env.0.block.clone();

        let instance = ContractInstance::new(id, self.canonical_length, &self);

        if self.instances.contains_key(&address) {
            panic!("Trying to instantiate an already existing address: {}.", address)
        }

        self.bank.writable().transfer(
            &env.0.message.sender,
            &address,
            env.0.message.sent_funds.clone()
        )?;

        self.instances.insert(address.clone(), instance);

        let instance = self.instances.get_mut(&address).unwrap();
        let result = contract.init(&mut instance.deps, env.0, msg);

        match result {
            Ok(msgs) => {
                let result = self.execute_messages(msgs.messages, address.clone(), block);

                match result {
                    Ok(_) => {
                        Ok(ContractLink {
                            address,
                            code_hash
                        })
                    },
                    Err(err) => {
                        self.instances.remove(&address);

                        Err(err)
                    }
                }
            },
            Err(err) => {
                self.instances.remove(&address);

                Err(err)
            }
        }
    }

    fn execute(
        &mut self,
        msg: Binary,
        env: MockEnv,
    ) -> StdResult<()> {
        let address = env.0.contract.address.clone();

        let instance = self.instances.get_mut(&address)
            .expect(&format!("Contract address doesn't exist: {}", address));

        self.bank.writable().transfer(
            &env.0.message.sender,
            &address,
            env.0.message.sent_funds.clone()
        )?;

        let contract = self.contracts.get(instance.index).unwrap();

        let block = env.0.block.clone();
        let result = contract.handle(&mut instance.deps, env.0, msg)?;

        self.execute_messages(result.messages, address, block)
    }

    pub(crate) fn query(
        &self,
        address: HumanAddr,
        msg: Binary
    ) -> StdResult<Binary> {
        let instance = self.instances.get(&address)
            .expect(&format!("Contract address doesn't exist: {}", address));

        let contract = self.contracts.get(instance.index).unwrap();

        contract.query(&instance.deps, msg)
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

    fn execute_messages(
        &mut self,
        messages: Vec<CosmosMsg>,
        sender: HumanAddr,
        block: BlockInfo
    ) -> StdResult<()> {
        for msg in messages {
            match msg {
                CosmosMsg::Wasm(msg) => {
                    match msg {
                        WasmMsg::Execute { contract_addr, msg, send, callback_code_hash } => {
                            let env = MockEnv::new(
                                sender.clone(),
                                ContractLink {
                                    address: contract_addr,
                                    code_hash: callback_code_hash
                                })
                                .sent_funds(send)
                                .chain_id(block.chain_id.clone())
                                .time(block.time)
                                .height(block.height);

                            self.execute(msg, env)?;
                        },
                        WasmMsg::Instantiate { code_id, msg, send, label, callback_code_hash } => {
                            let env = MockEnv::new(
                                sender.clone(),
                                ContractLink {
                                    address: label.into(),
                                    code_hash: callback_code_hash
                                })
                                .sent_funds(send)
                                .chain_id(block.chain_id.clone())
                                .time(block.time)
                                .height(block.height);

                            self.instantiate(code_id as usize, msg, env)?;
                        }
                    }
                },
                CosmosMsg::Bank(msg) => {
                    match msg {
                        BankMsg::Send { from_address, to_address, amount } => {
                            self.bank.writable().transfer(
                                &from_address,
                                &to_address,
                                amount
                            )?;
                        }
                    }
                },
                _ => panic!("Unsupported message: {:?}", msg)
            }
        }

        Ok(())
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
            .field("index", &self.index).finish()
    }
}

use fadroma::{
    schemars,
    schemars::JsonSchema,
    scrt_link::ContractLink,
    cosmwasm_std::{
        Env, HumanAddr, Coin,
        testing:: mock_env
    }
};

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Default, Debug, PartialEq, JsonSchema)]
pub struct MockEnv(pub(crate) Env);

impl MockEnv {
    /// Default values are what `cosmwasm_std::testing::mock_env` returns.
    pub fn new(sender: impl Into<HumanAddr>, contract: ContractLink<HumanAddr>) -> Self {
        let mut env = mock_env(sender, &[]);
        env.contract.address = contract.address;
        env.contract_code_hash = contract.code_hash;

        Self(env)
    }

    pub fn env(&self) -> &Env {
        &self.0
    }

    pub fn sent_funds(mut self, funds: Vec<Coin>) -> Self {
        self.0.message.sent_funds = funds;

        self
    }

    pub fn time(mut self, time: u64) -> Self {
        self.0.block.time = time;

        self
    }

    pub fn height(mut self, height: u64) -> Self {
        self.0.block.height = height;

        self
    }

    pub fn chain_id(mut self, chain_id: impl Into<String>) -> Self {
        self.0.block.chain_id = chain_id.into();

        self
    }

    pub fn contract_key(mut self, key: impl Into<String>) -> Self {
        self.0.contract_key = Some(key.into());

        self
    }
}

impl From<Env> for MockEnv {
    fn from(env: Env) -> Self {
        Self(env)
    }
}

use crate::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MockEnv {
    pub(crate) sender: Addr,
    pub(crate) contract: ContractLink<Addr>,
    pub(crate) sent_funds: Vec<Coin>
}

impl MockEnv {
    /// Default values are what `cosmwasm_std::testing::mock_env` returns.
    pub fn new(sender: impl Into<Addr>, contract: ContractLink<Addr>) -> Self {
        Self {
            sender: sender.into(),
            contract,
            sent_funds: vec![]
        }
    }

    pub fn sent_funds(mut self, funds: Vec<Coin>) -> Self {
        self.sent_funds = funds;

        self
    }
}

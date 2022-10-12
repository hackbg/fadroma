use serde::{Deserialize, Serialize};
use crate::schemars::{self, JsonSchema};
use crate::cosmwasm_std::{Addr, Coin};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MockEnv {
    pub(crate) sender: Addr,
    pub(crate) contract: Addr,
    pub(crate) sent_funds: Vec<Coin>
}

impl MockEnv {
    /// Default values are what `cosmwasm_std::testing::mock_env` returns.
    pub fn new(sender: impl Into<String>, contract: impl Into<String>) -> Self {
        Self {
            sender: Addr::unchecked(sender.into()),
            contract: Addr::unchecked(contract.into()),
            sent_funds: vec![]
        }
    }

    pub fn sent_funds(mut self, funds: Vec<Coin>) -> Self {
        self.sent_funds = funds;

        self
    }
}

use serde::{Deserialize, Serialize};
use crate::schemars::{self, JsonSchema};
use crate::cosmwasm_std::{Addr, Coin};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MockEnv {
    pub sender: Addr,
    pub contract: Addr,
    pub sent_funds: Vec<Coin>
}

impl MockEnv {
    /// Constructs a new instance of [`MockEnv`].
    /// 
    /// # Arguments
    ///
    /// * `sender` - The address that executes the contract i.e `info.sender`.
    /// * `contract` - The address of the contract to be executed i.e `env.contract.address`.
    pub fn new(sender: impl Into<String>, contract: impl Into<String>) -> Self {
        Self {
            sender: Addr::unchecked(sender),
            contract: Addr::unchecked(contract),
            sent_funds: vec![]
        }
    }

    /// Any funds that the sender is transferring to the executed contract.
    /// i.e `info.funds`.
    pub fn sent_funds(mut self, funds: Vec<Coin>) -> Self {
        self.sent_funds = funds;

        self
    }
}

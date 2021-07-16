//! Types used in batch operations
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use fadroma::scrt::cosmwasm_std::{Binary, HumanAddr, Uint128};

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TransferAction {
    pub recipient: HumanAddr,
    pub amount: Uint128,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendAction {
    pub recipient: HumanAddr,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TransferFromAction {
    pub owner: HumanAddr,
    pub recipient: HumanAddr,
    pub amount: Uint128,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendFromAction {
    pub owner: HumanAddr,
    pub recipient: HumanAddr,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct MintAction {
    pub recipient: HumanAddr,
    pub amount: Uint128,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct BurnFromAction {
    pub owner: HumanAddr,
    pub amount: Uint128,
    #[cfg(feature = "snip21")]
    pub memo: Option<String>,
}

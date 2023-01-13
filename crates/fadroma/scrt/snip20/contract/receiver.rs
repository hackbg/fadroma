use crate::{
    cosmwasm_std::{
        Addr, Uint128, Binary, StdResult, CosmosMsg, WasmMsg, to_binary
    },
    scrt::{BLOCK_SIZE, space_pad}
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Snip20ReceiveMsg should be de/serialized under `Receive()` variant in a HandleMsg
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct Snip20ReceiveMsg {
    pub sender: Addr,
    pub from: Addr,
    pub amount: Uint128,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
    pub msg: Option<Binary>,
}

impl Snip20ReceiveMsg {
    pub fn new(
        sender: Addr,
        from: Addr,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
    ) -> Self {
        Self {
            sender,
            from,
            amount,
            memo,
            msg,
        }
    }

    /// serializes the message, and pads it to 256 bytes
    pub fn into_binary(self) -> StdResult<Binary> {
        let msg = ReceiverHandleMsg::Receive(self);
        let mut data = to_binary(&msg)?;
        space_pad(&mut data.0, BLOCK_SIZE);
        Ok(data)
    }

    /// creates a cosmos_msg sending this struct to the named contract
     pub fn into_cosmos_msg(
        self,
        code_hash: String,
        contract_addr: String,
    ) -> StdResult<CosmosMsg> {
        let msg = self.into_binary()?;

        let execute = WasmMsg::Execute {
            msg,
            code_hash,
            contract_addr,
            funds: vec![],
        };
        
        Ok(execute.into())
    }
}

// This is just a helper to properly serialize the above message
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
enum ReceiverHandleMsg {
    Receive(Snip20ReceiveMsg),
}

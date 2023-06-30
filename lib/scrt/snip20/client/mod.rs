//! SNIP-20 token interface definitions from a contract.

mod interface;
pub use interface::*;

use crate::{
    core::ContractLink,
    cosmwasm_std::{
        Addr, Binary, CosmosMsg, QuerierWrapper,
        StdResult, Uint128, Coin, StdError
    },
    scrt::{vk, BLOCK_SIZE, to_cosmos_msg},
};

/// SNIP-20 token wrapper to easily call methods
/// on contracts that implement the standard.
#[derive(Clone, Debug)]
pub struct ISnip20 {
    pub link: ContractLink<Addr>,
    padding: Option<String>,
    memo: Option<String>,
    funds: Vec<Coin>,
    block_size: usize,
}

impl ISnip20 {
    #[inline]
    pub fn new(address: Addr, code_hash: String) -> Self {
        Self {
            link: ContractLink { address, code_hash },
            padding: None,
            memo: None,
            block_size: BLOCK_SIZE,
            funds: vec![]
        }
    }

    #[inline]
    pub fn memo(mut self, memo: String) -> Self {
        self.memo = Some(memo);

        self
    }

    #[inline]
    pub fn block_size(mut self, size: usize) -> Self {
        self.block_size = size;

        self
    }

    #[inline]
    pub fn padding(mut self, padding: String) -> Self {
        self.padding = Some(padding);

        self
    }

    #[inline]
    pub fn add_funds(mut self, coin: Coin) -> Self {
        self.funds.push(coin);

        self
    }

    #[inline]
    pub fn mint(
        mut self, recipient: String,
        amount: Uint128,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Mint {
            recipient,
            amount,
            memo,
            decoys,
            entropy,
            padding
        })
    }

    #[inline]
    pub fn set_minters(mut self, minters: Vec<String>) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::SetMinters {
            minters,
            padding
        })
    }

    #[inline]
    pub fn send(
        mut self,
        recipient: String,
        amount: Uint128,
        msg: Option<Binary>,
        recipient_code_hash: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Send {
            recipient,
            recipient_code_hash,
            amount,
            msg,
            memo,
            decoys,
            entropy,
            padding
        })
    }

    #[inline]
    pub fn send_from(
        mut self,
        owner: String,
        recipient: String,
        amount: Uint128,
        msg: Option<Binary>,
        recipient_code_hash: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::SendFrom {
            owner,
            recipient,
            recipient_code_hash,
            amount,
            msg,
            memo,
            entropy,
            decoys,
            padding
        })
    }

    #[inline]
    pub fn register_receive(mut self, code_hash: String) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::RegisterReceive {
            code_hash,
            padding
        })
    }

    #[inline]
    pub fn transfer(
        mut self,
        recipient: String,
        amount: Uint128,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Transfer {
            recipient,
            amount,
            memo,
            entropy,
            decoys,
            padding
        })
    }

    #[inline]
    pub fn transfer_from(
        mut self,
        owner: String,
        recipient: String,
        amount: Uint128,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::TransferFrom {
            owner,
            recipient,
            amount,
            memo,
            entropy,
            decoys,
            padding
        })
    }

    #[inline]
    pub fn batch_transfer(
        mut self,
        actions: Vec<TransferAction>,
        entropy: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::BatchTransfer {
            actions,
            entropy,
            padding
        })
    }

    #[inline]
    #[cfg(feature = "vk")]
    pub fn set_viewing_key(mut self, key: impl Into<String>) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&vk::auth::ExecuteMsg::SetViewingKey {
            key: key.into(),
            padding
        })
    }

    #[inline]
    pub fn increase_allowance(
        mut self,
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::IncreaseAllowance {
            spender,
            amount,
            expiration,
            padding
        })
    }

    pub fn query_balance(
        self,
        querier: QuerierWrapper,
        address: impl Into<String>,
        key: impl Into<String>
    ) -> StdResult<Uint128> {
        let resp: QueryAnswer = querier.query_wasm_smart(
            self.link.code_hash,
            self.link.address,
            &QueryMsg::Balance {
                address: address.into(),
                key: key.into()
            }
        )?;

        match resp {
            QueryAnswer::Balance { amount } => Ok(amount),
            _ => Err(StdError::generic_err("SNIP-20: expecting Balance response."))
        }
    }

    pub fn query_token_info(self, querier: QuerierWrapper) -> StdResult<TokenInfo> {
        let resp: QueryAnswer = querier.query_wasm_smart(
            self.link.code_hash,
            self.link.address,
            &QueryMsg::TokenInfo { }
        )?;

        match resp {
            QueryAnswer::TokenInfo(info) => Ok(info),
            _ => Err(StdError::generic_err("SNIP-20: expecting TokenInfo response."))
        }
    }

    #[inline]
    fn cosmos_msg(self, msg: &impl serde::Serialize) -> StdResult<CosmosMsg> {
        to_cosmos_msg(
            self.link.address.into_string(),
            self.link.code_hash,
            msg
        )
    }
}

impl From<ContractLink<Addr>> for ISnip20 {
    #[inline]
    fn from(link: ContractLink<Addr>) -> Self {
        Self::new(link.address, link.code_hash)
    }
}

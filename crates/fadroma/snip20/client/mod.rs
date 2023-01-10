//! Command SNIP-20 tokens from a contract.
//! *Feature flag: `snip20-client`*

use crate::{
    core::ContractLink,
    cosmwasm_std::{
        Addr, Binary, CosmosMsg, WasmMsg, QuerierWrapper,
        StdResult, Uint128, Coin, StdError, to_binary
    },
    scrt::{BLOCK_SIZE, space_pad},
};

pub mod msg;

use msg::{ExecuteMsg, QueryMsg, QueryAnswer, TokenInfo, TransferAction};

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
    pub fn mint(mut self, recipient: String, amount: Uint128) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Mint {
            recipient,
            amount,
            memo,
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
        recipient_code_hash: Option<String>
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Send {
            recipient,
            recipient_code_hash,
            amount,
            msg,
            memo,
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
        recipient_code_hash: Option<String>
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
    pub fn transfer(mut self, recipient: String, amount: Uint128) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::Transfer {
            recipient,
            amount,
            memo,
            padding
        })
    }

    #[inline]
    pub fn transfer_from(
        mut self,
        owner: String,
        recipient: String,
        amount: Uint128,
    ) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();
        let memo = self.memo.take();

        self.cosmos_msg(&ExecuteMsg::TransferFrom {
            owner,
            recipient,
            amount,
            memo,
            padding
        })
    }

    #[inline]
    pub fn batch_transfer(mut self, actions: Vec<TransferAction>) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::BatchTransfer {
            actions,
            padding
        })
    }

    #[inline]
    pub fn set_viewing_key(mut self, key: impl Into<String>) -> StdResult<CosmosMsg> {
        let padding = self.padding.take();

        self.cosmos_msg(&ExecuteMsg::SetViewingKey {
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

    fn cosmos_msg(self, msg: &ExecuteMsg) -> StdResult<CosmosMsg> {
        let mut msg = to_binary(msg)?;
        space_pad(&mut msg.0, self.block_size);

        Ok(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: self.link.address.into_string(),
            code_hash: self.link.code_hash,
            msg,
            funds: self.funds
        }))
    }
}

impl From<ContractLink<Addr>> for ISnip20 {
    #[inline]
    fn from(link: ContractLink<Addr>) -> Self {
        Self::new(link.address, link.code_hash)
    }
}

//! *Feature flag: `snip20-client`*
//! Command SNIP-20 tokens from a contract.

use crate::{
    core::ContractLink,
    cosmwasm_std::{Addr, Binary, CosmosMsg, QuerierWrapper, StdResult, Uint128},
    scrt::BLOCK_SIZE,
};
use secret_toolkit_snip20 as snip20;

#[derive(Clone, Debug)]
pub struct ISnip20 {
    pub link: ContractLink<Addr>,
    padding: Option<String>,
    memo: Option<String>,
    block_size: usize,
}

impl ISnip20 {
    pub fn attach(link: ContractLink<Addr>) -> Self {
        Self {
            link,
            padding: None,
            memo: None,
            block_size: BLOCK_SIZE,
        }
    }

    pub fn attach_to(address: Addr, code_hash: String) -> Self {
        Self {
            link: ContractLink { address, code_hash },
            padding: None,
            memo: None,
            block_size: BLOCK_SIZE,
        }
    }

    pub fn memo(mut self, memo: String) -> Self {
        self.memo = Some(memo);

        self
    }

    pub fn mint(self, recipient: String, amount: Uint128) -> StdResult<CosmosMsg> {
        snip20::mint_msg(
            recipient,
            amount,
            self.memo,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn set_minters(self, minters: Vec<String>) -> StdResult<CosmosMsg> {
        snip20::set_minters_msg(
            minters,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn send(
        self,
        recipient: String,
        amount: Uint128,
        msg: Option<Binary>,
    ) -> StdResult<CosmosMsg> {
        snip20::send_msg(
            recipient,
            amount,
            msg,
            self.memo,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn send_from(
        self,
        owner: String,
        recipient: String,
        amount: Uint128,
        msg: Option<Binary>,
    ) -> StdResult<CosmosMsg> {
        snip20::send_from_msg(
            owner,
            recipient,
            amount,
            msg,
            self.memo,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn register_receive(self, hash: String) -> StdResult<CosmosMsg> {
        snip20::register_receive_msg(
            hash,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn transfer(self, recipient: String, amount: Uint128) -> StdResult<CosmosMsg> {
        snip20::transfer_msg(
            recipient,
            amount,
            self.memo,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn batch_transfer(self, transfers: &[(String, Uint128)]) -> StdResult<CosmosMsg> {
        snip20::batch_transfer_msg(
            transfers
                .iter()
                .map(|(addr, amount)| {
                    snip20::batch::TransferAction::new(addr.clone(), amount.clone(), None)
                })
                .collect::<Vec<_>>(),
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn transfer_from(
        self,
        owner: String,
        recipient: String,
        amount: Uint128,
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_from_msg(
            owner,
            recipient,
            amount,
            self.memo,
            self.padding,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn set_viewing_key(self, vk: &str) -> StdResult<CosmosMsg> {
        snip20::set_viewing_key_msg(
            vk.into(),
            None,
            BLOCK_SIZE,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn increase_allowance(
        self,
        recipient: String,
        amount: Uint128,
        duration: Option<u64>,
    ) -> StdResult<CosmosMsg> {
        snip20::increase_allowance_msg(
            recipient,
            amount,
            duration,
            None,
            BLOCK_SIZE,
            self.link.code_hash,
            self.link.address.into(),
        )
    }

    pub fn query_balance(
        self,
        querier: QuerierWrapper,
        address: String,
        vk: &str,
    ) -> StdResult<Uint128> {
        Ok(snip20::balance_query(
            querier,
            address,
            vk.into(),
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )?
        .amount)
    }

    pub fn query_token_info(self, querier: QuerierWrapper) -> StdResult<snip20::TokenInfo> {
        snip20::token_info_query(
            querier,
            self.block_size,
            self.link.code_hash,
            self.link.address.into(),
        )
    }
}

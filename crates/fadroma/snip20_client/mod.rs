//! Command SNIP-20 tokens from a contract.

use fadroma_platform_scrt::{
    cosmwasm_std::{HumanAddr, Uint128, StdResult, CosmosMsg, Binary, Querier},
    ContractLink, BLOCK_SIZE
};
use secret_toolkit::snip20;

#[derive(Clone, Debug)]
pub struct ISnip20 {
    pub link:   ContractLink<HumanAddr>,
    padding:    Option<String>,
    memo:       Option<String>,
    block_size: usize
}

impl ISnip20 {

    pub fn attach (link: ContractLink<HumanAddr>) -> Self {
        Self {
            link,
            padding:    None,
            memo:       None,
            block_size: BLOCK_SIZE
        }
    }

    pub fn attach_to (address: &HumanAddr, code_hash: &String) -> Self {
        Self {
            link: ContractLink { address: address.clone(), code_hash: code_hash.clone() },
            padding:    None,
            memo:       None,
            block_size: BLOCK_SIZE
        }
    }

    pub fn memo(mut self, memo: String) -> Self {
        self.memo = Some(memo);

        self
    }

    pub fn mint (
        &self, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::mint_msg(
            recipient.clone(), amount, self.memo.clone(),
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn set_minters (
        &self, minters: &Vec<HumanAddr>
    ) -> StdResult<CosmosMsg> {
        snip20::set_minters_msg(
            minters.clone(),
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn send (
        &self, recipient: &HumanAddr, amount: Uint128, msg: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        snip20::send_msg(
            recipient.clone(), amount, msg, self.memo.clone(),
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn send_from (
        &self, owner: &HumanAddr, recipient: &HumanAddr,
        amount: Uint128, msg: Option<Binary>
    ) -> StdResult<CosmosMsg> {
        snip20::send_from_msg(
            owner.clone(), recipient.clone(), amount, msg,
            self.memo.clone(), self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn register_receive (&self, hash: String) -> StdResult<CosmosMsg> {
        snip20::register_receive_msg(
            hash,
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn transfer (
        &self, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_msg(
            recipient.clone(), amount, self.memo.clone(),
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn batch_transfer (
        &self, transfers: &[(HumanAddr, Uint128)]
    ) -> StdResult<CosmosMsg> {
        snip20::batch_transfer_msg(
            transfers.iter().map(|(addr, amount)| {
                snip20::batch::TransferAction::new(addr.clone(), *amount, None)
            }).collect::<Vec<_>>(),
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn transfer_from (
        &self, owner: &HumanAddr, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_from_msg(
            owner.clone(), recipient.clone(), amount,
            self.memo.clone(), self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn set_viewing_key (
        &self, vk: &str
    ) -> StdResult<CosmosMsg> {
        snip20::set_viewing_key_msg(
            vk.into(),
            None, BLOCK_SIZE,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn increase_allowance (
        &self, recipient: &HumanAddr, amount: Uint128, duration: Option<u64>
    ) -> StdResult<CosmosMsg> {
        snip20::increase_allowance_msg(
            recipient.clone(), amount, duration,
            None, BLOCK_SIZE,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn query_balance (
        &self, querier: &impl Querier, address: &HumanAddr, vk: &str
    ) -> StdResult<Uint128> {
        Ok(snip20::balance_query(
            querier, address.clone(), vk.into(),
            self.block_size, self.link.code_hash.clone(), self.link.address.clone()
        )?.amount)
    }

    pub fn query_token_info (
        &self, querier: &impl Querier
    ) -> StdResult<snip20::TokenInfo> {
        snip20::token_info_query(
            querier,
            self.block_size, self.link.code_hash.clone(), self.link.address.clone()
        )
    }

}

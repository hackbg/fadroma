use crate::{
    composable::BaseComposable,
    scrt::{
        BLOCK_SIZE, HumanAddr, StdResult,
        CosmosMsg, Uint128, Binary,
        Querier
    },
    scrt_link::ContractLink,
    secret_toolkit::snip20
};


pub struct ISnip20 <'a> {
    pub link:   &'a ContractLink<HumanAddr>,
    padding:    Option<String>,
    block_size: usize
}

impl<'a> ISnip20<'a> {

    pub fn attach (link: &'a ContractLink<HumanAddr>) -> Self {
        Self {
            link,
            padding:    None,
            block_size: BLOCK_SIZE
        }
    }

    pub fn mint (
        &self, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::mint_msg(
            recipient.clone(), amount,
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
            recipient.clone(), amount, msg,
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
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn transfer (
        &self, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_msg(
            recipient.clone(), amount,
            self.padding.clone(), self.block_size,
            self.link.code_hash.clone(), self.link.address.clone()
        )
    }

    pub fn transfer_from (
        &self, owner: &HumanAddr, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_from_msg(
            owner.clone(), recipient.clone(), amount,
            self.padding.clone(), self.block_size,
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

    pub fn query_balance (
        &self, querier: &impl Querier, address: &HumanAddr, vk: &str
    ) -> StdResult<Uint128> {
        Ok(snip20::balance_query(
            querier,
            address.clone(), vk.into(),
            self.block_size,
            self.link.code_hash.clone(),
            self.link.address.clone()
        )?.amount)
    }

    pub fn query_token_info (
        &self, querier: &impl Querier
    ) -> StdResult<snip20::TokenInfo> {
        snip20::token_info_query(
            querier,
            self.block_size,
            self.link.code_hash.clone(),
            self.link.address.clone()
        )
    }

}

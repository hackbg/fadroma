use fadroma_scrt_base::{
    cosmwasm_std::{Uint128, HumanAddr, CosmosMsg, StdResult, Querier},
    toolkit::snip20,
    BLOCK_SIZE
};
use fadroma_scrt_callback::ContractInstance;

pub struct ISnip20 {
    address:    HumanAddr,
    code_hash:  String,
    padding:    Option<String>,
    block_size: usize
}

impl ISnip20 {

    pub fn connect (link: ContractInstance<HumanAddr>) -> Self {
        Self {
            address:    link.address,
            code_hash:  link.code_hash,
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
            self.code_hash.clone(), self.address.clone()
        )
    }

    pub fn set_minters (
        &self, minters: &Vec<HumanAddr>
    ) -> StdResult<CosmosMsg> {
        snip20::set_minters_msg(
            minters.clone(),
            self.padding.clone(), self.block_size,
            self.code_hash.clone(), self.address.clone()
        )
    }

    pub fn transfer (
        &self, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_msg(
            recipient.clone(), amount,
            self.padding.clone(), self.block_size,
            self.code_hash.clone(), self.address.clone()
        )
    }

    pub fn transfer_from (
        &self, owner: &HumanAddr, recipient: &HumanAddr, amount: Uint128
    ) -> StdResult<CosmosMsg> {
        snip20::transfer_from_msg(
            owner.clone(), recipient.clone(), amount,
            self.padding.clone(), self.block_size,
            self.code_hash.clone(), self.address.clone()
        )
    }

    pub fn set_viewing_key (
        &self, vk: &str
    ) -> StdResult<CosmosMsg> {
        snip20::set_viewing_key_msg(
            vk.into(),
            None, BLOCK_SIZE,
            self.code_hash.clone(), self.address.clone()
        )
    }

    pub fn query <'a, Q: Querier> (
        &'a self, querier: &'a Q
    ) -> ISnip20Querier<'a, Q> {
        ISnip20Querier { snip20: &self, querier }
    }

}

pub struct ISnip20Querier <'a, Q: Querier> {
    snip20:  &'a ISnip20,
    querier: &'a Q
}

impl <'a, Q: Querier> ISnip20Querier <'a, Q> {
    pub fn balance (&self, address: &HumanAddr, vk: &str) -> StdResult<Uint128> {
        Ok(snip20::balance_query(
            self.querier,
            address.clone(), vk.into(),
            self.snip20.block_size,
            self.snip20.code_hash.clone(),
            self.snip20.address.clone()
        )?.amount)
    }
}

pub use snip20::*;

use cosmwasm_std::{Extern, Storage, Api, Querier, HumanAddr, StdResult, StdError, Binary, Env, HandleResponse};

pub mod msg;
pub mod receiver;
pub mod state;
pub mod batch;
pub mod transaction_history;

mod snip20;
mod utils;
#[cfg(test)]
mod tests;

/// Implements SNIP20, SNIP21 and SNIP22.
pub struct DefaultSnip20Impl;
/// Implements only SNIP20.
pub struct VanillaSnip20Impl;
/// Implements SNIP20 and SNIP22.
pub struct DisabledSnip21Impl;
/// Implements SNIP20 and SNIP21.
pub struct DisabledSnip22Impl;

impl Snip20 for DefaultSnip20Impl { }

impl Snip20 for DisabledSnip21Impl {
    fn query_transactions<S: Storage, A: Api, Q: Querier>(
        &self, 
        _deps: &Extern<S, A, Q>,
        _account: &HumanAddr,
        _page: u32,
        _page_size: u32
    ) -> StdResult<Binary> {
        disable_snip21()
    }

    fn query_transfers<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &Extern<S, A, Q>,
        _account: &HumanAddr,
        _page: u32,
        _page_size: u32
    ) -> StdResult<Binary> {
        disable_snip21()
    }
}

impl Snip20 for DisabledSnip22Impl {
    fn batch_burn_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::BurnFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_mint<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::MintAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()    
    }

    fn batch_send<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::SendAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_send_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::SendFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_transfer<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::TransferAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_transfer_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::TransferFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }
}

impl Snip20 for VanillaSnip20Impl {
    fn batch_burn_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::BurnFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_mint<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::MintAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()    
    }

    fn batch_send<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::SendAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_send_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::SendFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_transfer<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::TransferAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn batch_transfer_from<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &mut Extern<S, A, Q>,
        _env: Env,
        _actions: Vec<batch::TransferFromAction>
    ) -> StdResult<HandleResponse> {
        disable_snip22()
    }

    fn query_transactions<S: Storage, A: Api, Q: Querier>(
        &self, 
        _deps: &Extern<S, A, Q>,
        _account: &HumanAddr,
        _page: u32,
        _page_size: u32
    ) -> StdResult<Binary> {
        disable_snip21()
    }

    fn query_transfers<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &Extern<S, A, Q>,
        _account: &HumanAddr,
        _page: u32,
        _page_size: u32
    ) -> StdResult<Binary> {
        disable_snip21()
    }
}

#[inline(always)]
fn disable_snip21() -> StdResult<Binary> {
    Err(StdError::generic_err("SNIP21 functions have been disabled for this contract."))
}

#[inline(always)]
fn disable_snip22() -> StdResult<HandleResponse> {
    Err(StdError::generic_err("SNIP22 functions have been disabled for this contract."))
}

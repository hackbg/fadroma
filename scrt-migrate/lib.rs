pub mod types;
mod storage;
mod checks;

use cosmwasm_std::{Extern, Storage, Api, Querier, HumanAddr, StdResult};
use fadroma_scrt_addr::{Humanize, canonize};

pub fn get_status <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<types::ContractStatus<HumanAddr>> {
    storage::load(&deps.storage)?.humanize(&deps.api)
}
pub fn is_operational <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<()> {
    checks::is_operational(&get_status(deps)?)
}
pub fn can_set_status <S: Storage, A: Api, Q: Querier>  (
    deps: &Extern<S, A, Q>,
    to_level: &types::ContractStatusLevel
) -> StdResult<()> {
    checks::can_set_status(&get_status(deps)?, to_level)
}
pub fn set_status <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>,
    level: types::ContractStatusLevel,
    reason: String,
    new_address: Option<HumanAddr>
) -> StdResult<()> {
    storage::save(&mut deps.storage, &types::ContractStatus { level, reason, new_address: match new_address {
        Some(new_address) => Some(canonize(&deps.api, &new_address)?),
        None => None
    } })
}

#[macro_export] macro_rules! with_status {
    ($deps: ident, match $msg:ident { $($rest:tt)* }) => {
        if let HandleMsg::SetStatus { level, reason, new_address } = $msg {
            can_set_status(&$deps, &level)?;
            set_status($deps, level, reason, new_address)?;
            Ok(HandleResponse::default())
        } else {
            is_operational(&$deps)?;
            match $msg {
                HandleMsg::SetStatus { .. } => unreachable!(),
                $($rest)*
            }
        }
    }
}

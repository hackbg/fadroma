pub mod types;
mod storage;
mod checks;

use cosmwasm_std::{Extern, Storage, Api, Querier, Env, HumanAddr, StdResult};
use composable_admin::{require_admin, admin::assert_admin};
use fadroma_scrt_addr::{Humanize, Canonize};

/// Return the current contract status. Defaults to operational if nothing was stored.
pub fn get_status <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<types::ContractStatus<HumanAddr>> {
    storage::load(&deps.storage)?.humanize(&deps.api)
}

/// Fail if the current contract status level is other than `Operational`.
pub fn is_operational <S: Storage, A: Api, Q: Querier> (
    deps: &Extern<S, A, Q>
) -> StdResult<()> {
    checks::is_operational(&get_status(deps)?)
}

/// Fail if trying to return from `Migrating` status.
pub fn can_set_status <S: Storage, A: Api, Q: Querier>  (
    deps: &Extern<S, A, Q>,
    to_level: &types::ContractStatusLevel
) -> StdResult<()> {
    checks::can_set_status(&get_status(deps)?, to_level)
}

/// Store a new contract status.
#[require_admin]
pub fn set_status <S: Storage, A: Api, Q: Querier> (
    deps: &mut Extern<S, A, Q>,
    env: Env,
    level: types::ContractStatusLevel,
    reason: String,
    new_address: Option<HumanAddr>
) -> StdResult<()> {
    storage::save(&mut deps.storage, &types::ContractStatus { level, reason, new_address: match new_address {
        Some(new_address) => Some(new_address.canonize(&deps.api)?),
        None => None
    } })
}

/// Wrap status levels around the `match` statement that does your handle dispatch.
#[macro_export] macro_rules! with_status {
    // by default, assumes the handle msg enum is called `HandleMsg` and imported
    ($deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        with_status!(HandleMsg, $deps, $env, match $msg { $($rest)* })
    };
    // but an alternative name can be passed
    ($HandleMsg:ty, $deps:ident, $env:ident, match $msg:ident { $($rest:tt)* }) => {
        if let HandleMsg::SetStatus { level, reason, new_address } = $msg {
            fadroma_scrt_migrate::can_set_status(&$deps, &level)?;
            fadroma_scrt_migrate::set_status($deps, $env, level, reason, new_address)?;
            Ok(HandleResponse::default())
        } else {
            fadroma_scrt_migrate::is_operational(&$deps)?;
            match $msg {
                HandleMsg::SetStatus { .. } => unreachable!(),
                $($rest)*
            }
        }
    }
}

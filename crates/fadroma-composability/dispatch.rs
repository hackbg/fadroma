use fadroma_platform_scrt::*;
use crate::core::*;

/// Trait for handle messages
pub trait HandleDispatch <S, A, Q, C> where
    S: Storage,
    A: Api,
    Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_handle (self, core: &mut C, env: Env) -> StdResult<HandleResponse>;
}

/// Trait for query messages
pub trait QueryDispatch <S, A, Q, C, R> where
    S: Storage,
    A: Api,
    Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<R>;
}


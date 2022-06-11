//! Configurable integration testing harness.

#[cfg(not(target_arch = "wasm32"))]
mod bank;
#[cfg(not(target_arch = "wasm32"))]
mod ensemble;
#[cfg(not(target_arch = "wasm32"))]
mod env;
#[cfg(not(target_arch = "wasm32"))]
mod querier;
#[cfg(not(target_arch = "wasm32"))]
mod revertable;
#[cfg(not(target_arch = "wasm32"))]
mod storage;
#[cfg(not(target_arch = "wasm32"))]
mod block;

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests;
#[cfg(not(target_arch = "wasm32"))]
pub use ensemble::*;
#[cfg(not(target_arch = "wasm32"))]
pub use env::*;
#[cfg(not(target_arch = "wasm32"))]
pub use querier::*;
#[cfg(not(target_arch = "wasm32"))]
pub use block::Block;

/// Implement ContractHarness for the harness struct.
/// Use this to enable Fadroma Ensemble for a contract.
#[macro_export]
macro_rules! impl_contract_harness_default {
    ($name:ident, $contract:ident) => {
        impl ContractHarness for $name {
            fn init(&self, deps: &mut MockDeps, env: Env, msg: Binary) -> StdResult<InitResponse> {
                $contract::init(deps, env, from_binary(&msg)?, $contract::DefaultImpl)
            }
            fn handle(
                &self,
                deps: &mut MockDeps,
                env: Env,
                msg: Binary,
            ) -> StdResult<HandleResponse> {
                $contract::handle(deps, env, from_binary(&msg)?, $contract::DefaultImpl)
            }
            fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
                $contract::query(deps, from_binary(&msg)?, $contract::DefaultImpl)
            }
        }
    };
}


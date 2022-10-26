//! *Feature flag: `ensemble`*
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
mod storage;
#[cfg(not(target_arch = "wasm32"))]
mod block;
#[cfg(not(target_arch = "wasm32"))]
mod response;
#[cfg(not(target_arch = "wasm32"))]
mod staking;
#[cfg(not(target_arch = "wasm32"))]
mod state;

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
#[cfg(not(target_arch = "wasm32"))]
pub use response::*;
#[cfg(not(target_arch = "wasm32"))]
pub use anyhow;

/// Generate a struct and implement ContractHarness for the given contract module.
#[macro_export]
macro_rules! impl_contract_harness_default {
    ($visibility:vis $name:ident, $module:ident) => {
        struct $name;

        impl ContractHarness for $name {
            fn instantiate(
                &self,
                deps: &mut ensemble::MockDeps,
                env: cosmwasm_std::Env,
                info: cosmwasm_std::MessageInfo,
                msg: cosmwasm_std::Binary
            ) -> ensemble::AnyResult<cosmwasm_std::Response> {
                let result = $module::instantiate(deps.as_mut(), env, info, cosmwasm_std::from_binary(&msg)?, $module::DefaultImpl)?;

                Ok(result)
            }

            fn execute(
                &self,
                deps: &mut ensemble::MockDeps,
                env: cosmwasm_std::Env,
                info: cosmwasm_std::MessageInfo,
                msg: cosmwasm_std::Binary
            ) -> ensemble::AnyResult<cosmwasm_std::Response> {
                let result = $module::execute(deps.as_mut(), env, info, cosmwasm_std::from_binary(&msg)?, $module::DefaultImpl)?;

                Ok(result)
            }

            fn query(
                &self,
                deps: &ensemble::MockDeps,
                env: cosmwasm_std::Env,
                msg: cosmwasm_std::Binary
            ) -> ensemble::AnyResult<cosmwasm_std::Binary> {
                let result = $module::query(deps.as_ref(), env, cosmwasm_std::from_binary(&msg)?, $module::DefaultImpl)?;

                Ok(result)
            }
        }
    };
}

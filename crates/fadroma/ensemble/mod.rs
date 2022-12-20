//! *Feature flag: `ensemble`*
//! Configurable integration testing harness.

mod bank;
mod ensemble;
mod env;
mod querier;
mod storage;
mod block;
mod response;
mod staking;
mod state;
mod execution_state;
mod error;
mod event;

#[cfg(test)]
mod tests;

pub use ensemble::*;
pub use env::*;
pub use querier::*;
pub use block::Block;
pub use response::*;
pub use error::*;
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

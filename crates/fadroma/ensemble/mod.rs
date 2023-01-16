//! Test multiple contract interactions using unit tests.
//! *Feature flag: `ensemble`*

mod bank;
mod ensemble;
mod env;
mod querier;
mod storage;
mod block;
mod response;
#[cfg(feature = "ensemble-staking")]
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
/// Alternatively, if using the derive contract macro, specify the third argument
/// which is the implementation struct to use.
#[macro_export]
macro_rules! impl_contract_harness {
    ($visibility:vis $name:ident, $module:ident) => {
        $visibility struct $name;

        impl fadroma::ensemble::ContractHarness for $name {
            fn instantiate(
                &self,
                deps: fadroma::cosmwasm_std::DepsMut,
                env: fadroma::cosmwasm_std::Env,
                info: fadroma::cosmwasm_std::MessageInfo,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Response> {
                let result = $module::instantiate(
                    deps,
                    env,
                    info,
                    fadroma::cosmwasm_std::from_binary(&msg)?
                )?;

                Ok(result)
            }

            fn execute(
                &self,
                deps: fadroma::cosmwasm_std::DepsMut,
                env: fadroma::cosmwasm_std::Env,
                info: fadroma::cosmwasm_std::MessageInfo,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Response> {
                let result = $module::execute(
                    deps,
                    env,
                    info,
                    fadroma::cosmwasm_std::from_binary(&msg)?
                )?;

                Ok(result)
            }

            fn query(
                &self,
                deps: fadroma::cosmwasm_std::Deps,
                env: fadroma::cosmwasm_std::Env,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Binary> {
                let result = $module::query(
                    deps,
                    env,
                    fadroma::cosmwasm_std::from_binary(&msg)?
                )?;

                Ok(result)
            }
        }
    };

    ($visibility:vis $name:ident, $module:ident, $impl_struct:ident) => {
        $visibility struct $name;

        impl fadroma::ensemble::ContractHarness for $name {
            fn instantiate(
                &self,
                deps: fadroma::cosmwasm_std::DepsMut,
                env: fadroma::cosmwasm_std::Env,
                info: fadroma::cosmwasm_std::MessageInfo,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Response> {
                let result = $module::instantiate(
                    deps,
                    env,
                    info,
                    fadroma::cosmwasm_std::from_binary(&msg)?,
                    $impl_struct
                )?;

                Ok(result)
            }

            fn execute(
                &self,
                deps: fadroma::cosmwasm_std::DepsMut,
                env: fadroma::cosmwasm_std::Env,
                info: fadroma::cosmwasm_std::MessageInfo,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Response> {
                let result = $module::execute(
                    deps,
                    env,
                    info,
                    fadroma::cosmwasm_std::from_binary(&msg)?,
                    $impl_struct
                )?;

                Ok(result)
            }

            fn query(
                &self,
                deps: fadroma::cosmwasm_std::Deps,
                env: fadroma::cosmwasm_std::Env,
                msg: fadroma::cosmwasm_std::Binary
            ) -> fadroma::ensemble::AnyResult<fadroma::cosmwasm_std::Binary> {
                let result = $module::query(
                    deps,
                    env,
                    fadroma::cosmwasm_std::from_binary(&msg)?,
                    $impl_struct
                )?;

                Ok(result)
            }
        }
    };
}

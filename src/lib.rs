#[macro_export]
macro_rules! message {
    (
        $Msg: ident { $( $arg: ident: $type: ty ),* }
    ) => {
        #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
        pub struct $Msg { pub $($arg: $type),* }
    }
}

#[macro_export]
macro_rules! contract {
    (
        $ConfigKey:literal

        $InitMsgType:ident (
            $InitDeps:ident, $InitEnv:ident, $InitMsg:ident : {
                $($InitMsgArg:ident : $InitMsgArgType:ty),*
            }
        ) -> $StateType:ident {
            $($StateKey:ident : $StateKeyType:ty = $StateKeyValue:expr),*
        }

        $QueryMsgEnum:ident (
            $QueryDeps:ident, $QueryMsg:ident
        ) {
            $($QueryMsgType:ident (
                $($QueryMsgArg:ident : $QueryMsgArgType:ty),*
            ) $QueryMsgHandler:block)*
        }

        $HandleMsgEnum:ident (
            $HandleDeps:ident, $HandleEnv:ident, $HandleMsg:ident
        ) {
            $($HandleMsgType:ident {
                $($HandleMsgArg:ident : $HandleMsgArgType:ty),*
            } (&mut $HandleMsgState:ident) $HandleMsgHandler:block)*
        }

        $ResponseEnum:ident {
            $($Response:ident {
                $($ResponseArg:ident : $ResponseArgType:ty),*
            }),*
        }

    ) => {
        // Contract interface
        pub mod msg {
            use schemars::JsonSchema;
            use serde::{Deserialize, Serialize};
            message!($InitMsgType { $($InitMsgArg: $InitMsgArgType),* });
            messages!(
                $QueryMsgEnum {
                    $($QueryMsgType { $($QueryMsgArg: $QueryMsgArgType),* })*
                }
                $HandleMsgEnum {
                    $($HandleMsgType { $($HandleMsgArg: $HandleMsgArgType),* })*
                }
            );
            $(message!($Response { $($ResponseArg: $ResponseArgType),* });),*
        }

        // Contract implementation
        pub mod contract {
            state!($ConfigKey, $StateType ($InitDeps, $InitEnv, $InitMsg) {
                $($StateKey : $StateKeyType = $StateKeyValue),*
            }, config, config_read);
            query!($QueryMsgEnum ($QueryDeps, $QueryMsg) {
                $($QueryMsgType ($($QueryMsgArg),*) $QueryMsgHandler)*
            });
            handle!($HandleMsgEnum {
                $($HandleMsgType (&mut $HandleMsgState, $($HandleMsgArg),*) $HandleMsgHandler)*
            });
        }

        // Entry point
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            use super::contract;
            use cosmwasm_std::{ExternalApi, ExternalQuerier, ExternalStorage};
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_init(
                    &contract::init::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_handle(
                    &contract::handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                cosmwasm_std::do_query(
                    &contract::query::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    msg_ptr,
                )
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }
    }
}

#[macro_export]
macro_rules! state {
    (
        $ConfigKey:literal,
        $State:ident ( $InitDeps:ident, $InitEnv:ident, $InitMsg:ident )
        { $( $StateKey:ident : $StateType:ty = $StateInitValue:expr ),* },
        $Config:ident, $ConfigRead:ident
    ) => {
        pub mod state {
            use schemars::JsonSchema;
            use serde::{Deserialize, Serialize};
            use cosmwasm_std::{CanonicalAddr, Storage};
            use cosmwasm_storage::{singleton, singleton_read, ReadonlySingleton, Singleton};
            pub static CONFIG_KEY: &[u8] = $ConfigKey;
            #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
            pub struct $State {
                $(pub $StateKey: $StateType),*
            }
            pub fn $Config<S: Storage>(storage: &mut S) -> Singleton<S, $State> {
                singleton(storage, CONFIG_KEY)
            }
            pub fn $ConfigRead<S: Storage>(storage: &S) -> ReadonlySingleton<S, $State> {
                singleton_read(storage, CONFIG_KEY)
            }
        }

        use cosmwasm_std::{Api, Env, Extern, InitResponse, Querier, StdResult, Storage};
        pub fn init<S: Storage, A: Api, Q: Querier>(
            $InitDeps: &mut Extern<S, A, Q>,
            $InitEnv:  Env,
            $InitMsg:  crate::msg::InitMsg,
        ) -> StdResult<InitResponse> {
            let state = self::state::State {
                $( $StateKey: $StateInitValue ),*
            };
            self::state::config(&mut $InitDeps.storage).save(&state)?;
            Ok(InitResponse::default())
        }
    }
}

#[macro_export]
macro_rules! messages {
    (
        $( $group: ident {
            $($Msg: ident { $( $arg: ident : $type: ty ),* })+
        } )+
    ) => {
        $(
            $(
                #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
                pub struct $Msg { $(pub $arg: $type),* }
            )+

            #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
            #[serde(rename_all = "snake_case")]
            pub enum $group { $($Msg { $($arg : $type),* }),* }
        )+ }
}

#[macro_export]
macro_rules! handle {
    (
        $Enum:ident { $(
            $Msg:ident ( &mut $state:ident $(,$arg1:ident),* ) $handler:block
        )+ }
    ) => {
        use cosmwasm_std::HandleResponse;
        use crate::msg::$Enum;
        use self::state::config;
        pub fn handle <S: Storage, A: Api, Q: Querier> (
            deps: &mut Extern<S, A, Q>,
            env:  Env,
            msg:  $Enum,
        ) -> StdResult<HandleResponse> {
            match msg { $(
                $Enum::$Msg { $($arg1),* } => {
                    config(&mut deps.storage).update(|mut $state| $handler)?;
                    Ok(HandleResponse::default())
                }
            )+ }
        }
    }
}

#[macro_export]
macro_rules! query {
    (
        $Enum:ident ($Deps:ident, $Msg:ident) { $(
            $MsgType:ident ( $(,$arg1:ident),* ) $handler:block
        )+ }
    ) => {
        use cosmwasm_std::{to_binary, Binary};
        use crate::msg::$Enum;
        use self::state::config_read;
        pub fn query <S: Storage, A: Api, Q: Querier> (
            $Deps: &Extern<S, A, Q>,
            $Msg:  $Enum,
        ) -> StdResult<Binary> {
            match $Msg { $(
                $Enum::$MsgType { $($arg1),* } => $handler,
            )+ }
        }
    }
}

#[macro_export]
macro_rules! contract {

    // Entry point of the macro.
    (
        // Define the shape of the local datastore
        // which is essentially a collection of singletons.
        $StateType:ident $StateBody:tt

        // Define the signature of the init message,
        // and the initial state that an instance starts with.
        $InitMsgType:ident (
            $InitDeps:ident, $InitEnv:ident, $InitMsg:ident : {
                $($InitMsgArg:ident : $InitMsgArgType:ty),*
            }
        ) $InitBody:tt

        // Define query messages and how they're handled
        $QueryMsgEnum:ident (
            $QueryDeps:ident,
            $QueryMsg:ident
        ) {
            $($QueryMsgType:ident (
                $($QueryArg:ident : $QueryArgType:ty),*
            ) $QueryMsgBody:tt)*
        }

        // Define transaction messages and how they're handled
        $HandleMsgEnum:ident (
            $HandleDeps:ident,
            $HandleEnv:ident,
            $HandleSender:ident,
            $HandleMsg:ident
        ) {
            $($HandleMsgType:ident (
                $($HandleArg:ident : $HandleArgType:ty),*
            ) $HandleMsgBody:tt),*
        }

        // Define possible responses
        $RespEnum:ident {
            $($Resp:ident { $($RespField:ident : $RespFieldType:ty),* }),*
        }

    )=> {

        contract!(@state $StateType $StateBody);

        contract!(@init ($InitDeps, $InitEnv, $InitMsg : {
            $($InitMsgArg : $InitMsgArgType),*
        }) $InitBody);

        contract!(@query $QueryMsgEnum ($QueryDeps, $QueryMsg) {
            $($QueryMsgType ($($QueryArg : $QueryArgType),*) $QueryMsgBody)*
        });

        contract!(@handle $HandleMsgEnum (
            $HandleDeps, $HandleEnv, $HandleSender, $HandleMsg
        ) {
            $($HandleMsgType ($($HandleArg : $HandleArgType),*) $HandleMsgBody),*
        });

        // Public interface to the contract
        pub mod msg {
            message!($InitMsgType { $($InitMsgArg: $InitMsgArgType),* });
            $(message!($Resp { $($RespField: $RespFieldType),* });),*
            messages!(
                $QueryMsgEnum {
                    $($QueryMsgType {$($QueryArg: $QueryArgType),*})*
                }
                $HandleMsgEnum {
                    $($HandleMsgType {$($HandleArg: $HandleArgType),*})*
                }
            );
        }

        // WASM interface (entry point)
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            use super::contract;
            use cosmwasm_std::{ExternalApi, ExternalQuerier, ExternalStorage};
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_init(
                    &self::init::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_handle(
                    &self::handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                cosmwasm_std::do_query(
                    &self::query::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    msg_ptr,
                )
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }
    };

    (@state
        $Root:ident { $($NS:ident { $($Key:ident : $Type:ty),* })*
    }) => {
        pub mod state {
            use cosmwasm_std::{StdResult, Storage, to_vec};
            use cosmwasm_storage::{
                singleton, singleton_read,
                ReadonlySingleton, Singleton
            };
            $(
                message!($NS { $($Key: $Type),* });
                impl $NS {

                    pub fn save <
                        S: Storage
                    > (storage: &mut S, data: $NS) -> StdResult<()> {
                        Singleton::new(
                            storage,
                            &to_vec(stringify!($NS)).unwrap()
                        ).save(&data)
                    }

                    pub fn read <
                        S: Storage
                    > (storage: &S) -> StdResult<$NS> {
                        ReadonlySingleton::new(
                            storage,
                            &to_vec(stringify!($NS)).unwrap()
                        ).load()
                    }

                    pub fn update <
                        S: Storage,
                        A: FnOnce($NS) -> StdResult<$NS>
                    > (storage: &mut S, action: A) -> StdResult<$NS> {
                        Singleton::new(
                            storage,
                            &to_vec(stringify!($NS)).unwrap()
                        ).update(action)
                    }
                }
            )*
        }
        $(use self::state::$NS;)*
    };

    (@init (
        $Deps:ident, $Env:ident, $Msg:ident : {
            $($MsgField:ident : $MsgFieldType:ty),*
        }
    ) {
        $($StateNS:ident : { $($StateField:ident : $StateValue:expr),* })*
    }) => {
        // Contract initialisation
        pub fn init<
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        >(
            $Deps: &mut cosmwasm_std::Extern<S, A, Q>,
            $Env:  cosmwasm_std::Env,
            $Msg:  msg::InitMsg,
        ) -> cosmwasm_std::StdResult<cosmwasm_std::InitResponse> {
            $(state::$StateNS::save(
                &mut $Deps.storage,
                $StateNS { $($StateField: $StateValue),* }
            );)*
            Ok(cosmwasm_std::InitResponse::default())
        }
        };

    (@query
        $NS:ident ( $Deps:ident, $Msg:ident ) {
            $($MsgType:ident ( $($Arg:ident : $ArgType:ty),* ) {
                ($($State:ident : $StateNS:ident),*) $Code:block
            })*
        }
    ) => {
        pub fn query <
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        > (
            $Deps: &cosmwasm_std::Extern<S, A, Q>,
            $Msg:  msg::$NS
        ) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> {
            cosmwasm_std::to_binary(&match $Msg {
                $(msg::$NS::$MsgType { $($Arg,)* } => {
                    $(let $State = $StateNS::read(&$Deps.storage)?);*;
                    $Code
                })*
            })
        }
    };

    (@handle
        $NS:ident ($Deps:ident, $Env:ident, $Sender:ident, $Msg:ident) {
            $($MsgType:ident ( $($MsgArg:ident : $MsgArgType:ty),* ) {
                $(($State:ident : $(&mut)? $StateNS:ident) $Code:block)*
            }),*
        }) => {
            // Action handling
            pub fn handle <
                S: cosmwasm_std::Storage,
                A: cosmwasm_std::Api,
                Q: cosmwasm_std::Querier
            > (
                $Deps: &mut cosmwasm_std::Extern<S, A, Q>,
                $Env:  cosmwasm_std::Env,
                $Msg:  msg::$NS,
            ) -> cosmwasm_std::StdResult<cosmwasm_std::HandleResponse> {
                match $Msg {
                    $(msg::$NS::$MsgType { $($MsgArg),* } => {
                        let $Sender = $Deps.api.canonical_address(
                            &$Env.message.sender
                        )?;
                        Ok(cosmwasm_std::HandleResponse::default())
                    })*
                }
            }
        };

    (@handle_stage
        $Deps:ident $State:ident &mut $StateNS:ident $Code:block
    ) => {
        state::$StateNS::update(
            &mut $Deps.storage,
            |mut $State: $StateNS| {
                match $Code {
                    Ok ($HandleState) => Ok ($HandleState),
                    Err(msg)          => Err(msg)
                }
            }
        );
    };

    (@handle_stage
        $State:ident $StateNS:ident $Code:block
    ) => {
        $(let $State = $StateNS::read(&$Deps.storage)?);*;
        $Code
    };

}

#[macro_export]
macro_rules! messages {
    (
        $( $group: ident {
            $($Msg: ident { $( $arg: ident : $type: ty ),* })*
        } )*
    ) => {
        $(
            #[derive(
                serde::Serialize, serde::Deserialize,
                Clone, Debug, PartialEq,
                schemars::JsonSchema
            )]
            #[serde(rename_all = "snake_case")]
            pub enum $group { $($Msg { $($arg : $type),* }),* }

            $(message!($Msg { $($arg: $type),* });)*
        )* }
}

#[macro_export]
macro_rules! message {
    (
        $Msg:ident
        { $( $arg:ident : $type:ty ),* }
    ) => {
        #[derive(
            serde::Serialize, serde::Deserialize,
            Clone, Debug, PartialEq,
            schemars::JsonSchema
        )]
        pub struct $Msg { $(pub $arg: $type),* }
    }
}

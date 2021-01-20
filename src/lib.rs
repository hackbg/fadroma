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
        ) $InitBody:block

        // Define query messages and how they're handled
        $QueryNS:ident (
            $QueryDeps:ident,
            $QueryState:ident,
            $QueryMsg:ident
        ) {
            $($QueryMsgType:ident ($(
                $QueryMsgArg:ident : $QueryMsgArgType:ty
            ),*) $QueryMsgBody:tt)*
        }

        // Define transaction messages and how they're handled
        $HandleNS:ident (
            $HandleDeps:ident,
            $HandleEnv:ident,
            $HandleSender:ident,
            $HandleState:ident,
            $HandleMsg:ident
        ) {
            $($HandleMsgType:ident ($(
                $HandleMsgArg:ident : $HandleMsgArgType:ty
            ),*) $HandleMsgBody:tt)*
        }

        // Define possible responses
        $RespEnum:ident {
            $($Resp:ident { $($RespField:ident : $RespFieldType:ty),* }),*
        }

    ) => {

        // This macro has several sub-sections.
        // (An earlier version, as published [here](https://github.com/hackbg/hello-secret-network/blob/97b85f426b07751a40e628d7d237155c335216b6/src/macros.rs)
        // has them implemented as separate macros.)
        // They are called in turn below:

        contract!(@state $StateType $StateBody);

        contract!(@init ($InitDeps, $InitEnv, $InitMsg : {
            $($InitMsgArg : $InitMsgArgType),*
        }) $InitBody);

        contract!(@query $QueryNS ($QueryDeps, $QueryState, $QueryMsg) {
            $($QueryMsgType ($($QueryMsgArg:$QueryMsgArgType),*)
                $QueryMsgBody)*
        });

        contract!(@handle $HandleNS (
            $HandleDeps, $HandleEnv, $HandleSender, $HandleState, $HandleMsg
        ) { $(
            $HandleMsgType
            ($($HandleMsgArg:$HandleMsgArgType),*)
            $HandleMsgBody
        )* });

        // The reason sub-section parameters are not just passed as a `tt`
        // but need to be expanded in the initial invocation of the macro
        // is the following module, which represents the public interface
        // of the contract:
        pub mod msg {
            // The argument sets of the {Init,Query,Handle}Msg handlers
            // are used to automatically generate the corresponding
            // protocol messages; only responses can't be inferred.
            // TODO or can they?
            message!($InitMsgType { $($InitMsgArg: $InitMsgArgType),* });
            messages!(
                $QueryNS {
                    $($QueryMsgType {$($QueryMsgArg: $QueryMsgArgType),*})*
                }
                $HandleNS {
                    $($HandleMsgType {$($HandleMsgArg: $HandleMsgArgType),*})*
                }
            );
            $(message!($Resp { $($RespField: $RespFieldType),* });),*
        }

        // WASM interface (entry point)
        // This is mostly to be left alone.
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
        $State:ident { $($Key:ident : $Type:ty),* }
    ) => {
        message!($State { $($Key:$Type),* });
        pub static CONFIG_KEY: &[u8] = b"";
        pub fn get_state_rw<S: cosmwasm_std::Storage>(storage: &mut S)
            -> cosmwasm_storage::Singleton<S, $State> {
            cosmwasm_storage::singleton(storage, CONFIG_KEY)
        }
        pub fn get_state_ro<S: cosmwasm_std::Storage>(storage: &S)
            -> cosmwasm_storage::ReadonlySingleton<S, $State> {
            cosmwasm_storage::singleton_read(storage, CONFIG_KEY)
        }
    };

    (@init ($deps:ident, $env:ident, $msg:ident : {
        $($msg_field:ident : $msg_field_type:ty),*
    }) $body:block
    ) => {
        // Contract initialisation
        pub fn init<
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        >(
            $deps: &mut cosmwasm_std::Extern<S, A, Q>,
            $env:  cosmwasm_std::Env,
            $msg:  msg::InitMsg,
        ) -> cosmwasm_std::StdResult<cosmwasm_std::InitResponse> {
            get_state_rw(&mut $deps.storage).save(&$body);
            Ok(cosmwasm_std::InitResponse::default())
        }
    };

    (@query
        $NS:ident ( $deps:ident, $state:ident, $msg:ident ) {
            $($Msg:ident ( $($msg_field:ident : $msg_field_type:ty),* )
                $Code:block)* }
    ) => {
        pub fn query <
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        > (
            $deps: &cosmwasm_std::Extern<S, A, Q>,
            $msg:  msg::$NS
        ) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> {
            cosmwasm_std::to_binary(&match $msg {
                $(msg::$NS::$Msg { $($msg_field,)* } => {
                    let $state = get_state_ro(&$deps.storage).load()?;
                    $Code
                })*
            })
        }
    };

    (@handle
        $NS:ident (
            $Deps:ident, $Env:ident, $Sender:ident, $State:ident, $Msg:ident
        ) {
            $($MsgType:ident ( $($MsgArg:ident : $MsgArgType:ty),* )
                $Code:block)* }
    ) => {
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

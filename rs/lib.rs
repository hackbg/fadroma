//! # Fadroma

/// Define an enum that implements the necessary traits
/// (de/serialization, schema generation, cloning, debug printing, equality comparison)
#[macro_export] macro_rules! message {
    ( $Msg:ident { $( $(#[$meta:meta])* $field:ident : $type:ty ),* } ) => {
        #[derive(serde::Serialize,serde::Deserialize,Clone,Debug,PartialEq,schemars::JsonSchema)]
        #[serde(rename_all = "snake_case")]
        pub struct $Msg { $( $(#[$meta])* pub $field: $type ),* } } }

/// Define an enum with variants that implement the necessary traits
#[macro_export] macro_rules! messages {
    ( $( $Enum:ident { $( $(#[$meta:meta])* $Msg:ident { $( $field:ident : $type:ty ),* } )* } )*
    ) => { $(
        #[derive(serde::Serialize,serde::Deserialize,Clone,Debug,PartialEq,schemars::JsonSchema)]
        #[serde(rename_all = "snake_case")]
        pub enum $Enum { $( $(#[$meta])* $Msg { $($field : $type),* } ),* } )* } }

/// Define the state singleton.
// TODO: Support other shapes of state
#[macro_export] macro_rules! define_state_singleton {
    (
        $State:ident
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }
    ) => {
        /// State singleton
        message!($State { $($(#[$meta])* $state_field:$state_field_type),* });
        use cosmwasm_storage::{Singleton, singleton, ReadonlySingleton, singleton_read};
        pub static CONFIG_KEY: &[u8] = b"fadroma";
        pub fn get_store_rw<S: Storage>(storage: &mut S) -> Singleton<S, $State> {
            singleton(storage, CONFIG_KEY)
        }
        pub fn get_store_ro<S: Storage>(storage: &S) -> ReadonlySingleton<S, $State> {
            singleton_read(storage, CONFIG_KEY)
        }
    }
}

/// Instantiation interface.
#[macro_export] macro_rules! define_init_message {
    // if imported:
    ($_:ident, $Import:ident) => { pub use super::$Import; };
    // if defined in place:
    ($Name:ident, { $(
        $(#[$meta:meta])* $arg:ident : $type:ty
    ),* }) => {
        message!($Name { $($arg: $type),* });
    }
}

/// Query interface.
#[macro_export] macro_rules! define_q_messages {
    // if imported:
    ($_1:tt, $Import:ident, { $($_2:tt)* }) => { pub use super::$Import; };
    // if defined in place:
    ($Name:ident, { $(
        $(#[$meta:meta])* $Variant:ident ( $($arg:ident : $type:ty),* )
    )* }) => {
        messages!($Name { $( $(#[$meta])* $Variant {$($arg: $type),*} )* });
    };
}

/// Transaction interface.
#[macro_export] macro_rules! define_tx_messages {
    // if imported:
    ($_1:tt, $Import:ident, { $($_2:tt)* }) => { pub use super::$Import; };
    // if defined in place:
    ($Name:ident, { $(
        $(#[$meta:meta])* $Variant:ident ( $($arg:ident : $type:ty),* )
    )* }) => {
        messages!($Name { $( $(#[$meta])* $Variant {$($arg: $type),*} )* });
    };
}

/// Instatiation. Either defines or imports an `InitMsg`, and hooks up your init logic to it.
/// Function body must return the initial value of `State`.
#[macro_export] macro_rules! implement_init {
    // define the InitMsg in place:
    (
        $(#[$InitMeta:meta])* [$Init:ident]
        ($deps:ident, $env:ident, $msg:ident :{ $($field:ident : $type:ty),* }) $body:block
    ) => {
        use msg::$Init;
        $(#[$InitMeta])*
        pub fn init <S: Storage, A: Api, Q: Querier>(
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $Init
        ) -> StdResult<InitResponse> {
            $(let $field : $type = $msg.$field;)*
            get_store_rw(&mut $deps.storage).save(&$body)?;
            Ok(InitResponse::default())
        }
    };
    // or import it from an external module:
    (
        $(#[$InitMeta:meta])* [$_:ident]
        ($deps:ident, $env:ident, $msg:ident : $InitExt:ty ) $body:block
    ) => {
        $(#[$InitMeta])*
        pub fn init <S: Storage, A: Api, Q: Querier>(
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $InitExt
        ) -> StdResult<InitResponse> {
            // no auto-destructuring
            get_store_rw(&mut $deps.storage).save(&$body)?;
            Ok(InitResponse::default())
        }
    };
}

/// Query implementations.
#[macro_export] macro_rules! implement_queries {
    // for external query message type, ignore the name in the brackets
    // and pass through to the next macro variantb
    (
        $State:ident, $EnumExt:ident, $_:ident
        ( $deps:ident, $state:ident, $msg:ident ) -> $Response:ident { $($bodies:tt)* }
    ) => {
        implement_queries!($State, $EnumExt ( $deps, $state, $msg ) -> $Response { $($bodies)* });
    };

    // implement queries defined in $body
    (
        $State:ident, $Enum:ident
        ( $deps:ident, $state:ident, $msg:ident ) -> $Response:ident { $(
            $(#[$meta:meta])* $Variant:ident ( $($field:ident : $type:ty),*)
            $body:tt
        )* }
    ) => {
        /// Query dispatcher.
        pub fn query <S: Storage, A: Api, Q: Querier> (
            $deps: &Extern<S, A, Q>, $msg: msg::$Enum
        ) -> StdResult<Binary> {
            let state = get_store_ro(&$deps.storage).load()?; // get snapshot of contract state
            let result = match $msg { $( // find the matching handler
                msg::$Enum::$Variant {..} => self::queries::$Variant($deps, state, $msg),
            )* };
            Ok(cosmwasm_std::to_binary(&result?)?) // return handler result
        }
        /// Query handlers.
        mod queries {
            prelude!();
            use super::{*, msg::Response};
            // for every query message variant, define a handler 
            $(
                $(#[$meta])*
                #[allow(non_snake_case)]
                pub fn $Variant <S: Storage, A: Api, Q: Querier>(
                    $deps: &Extern<S, A, Q>, $state: $State, $msg: msg::$Enum,
                ) -> StdResult<$Response> {
                    if let super::msg::$Enum::$Variant {$($field),*} = $msg { // destructure the message
                        $body // perform user-specified actions
                    } else { unreachable!() }
                }
            )*
        }

    }
}

/// Transaction implementations
#[macro_export] macro_rules! implement_transactions {
    (   $State:ident, $Enum:ident, $_:ident
        ($deps:ident, $env:ident, $state:ident, $msg:ident) -> $Response:ident { $($bodies:tt)* }
    ) => {
        implement_transactions!($State, $Enum ($deps, $env, $state, $msg) -> $Response { $($bodies)* });
    };
    (   $State:ident, $Enum:ident
        ($deps:ident, $env:ident, $state:ident, $msg:ident) -> $Response:ident {
            $($(#[$meta:meta])* $Variant:ident ( $($arg:ident $(: $type:ty)?),* ) $body:block)*
        }
    ) => {
        // Ok/Err variants containing mutated state to be saved
        pub type HandleResult = StatefulResult<HandleResponse>;
        pub type StatefulResult<T> = Result<(T, Option<$State>), StatefulError>;
        pub struct StatefulError((StdError, Option<$State>));
        impl From<StdError> for StatefulError {
            /// **WARNING**: if `?` operator returns error, any state changes will be ignored
            /// * That's where the abstraction leaks, if only a tiny bit.
            ///   * Maybe implement handlers as closures that keep the state around.
            fn from (error: StdError) -> Self {
                StatefulError((error, None))
            }
        }

        /// Transaction dispatcher
        pub fn handle <S: Storage, A: Api, Q: Querier> (
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: msg::$Enum,
        ) -> StdResult<HandleResponse> {
            // pick the handler that matches the message and call it:
            let result = match $msg {
                $( msg::$Enum::$Variant {..} => self::handle::$Variant($deps, $env, $msg), )*
            };
            // separate the state from the rest of the result
            let state: Option<$State>;
            let (state, returned) = match result {
                Ok((response, next_state)) => (next_state, Ok(response)),
                Err(StatefulError((error, next_state))) => (next_state, Err(error))
            };
            // if there was a state update in the result, save it now
            if let Some(state) = state {
                let mut store = get_store_rw(&mut $deps.storage);
                store.save(&state)?;
            }
            return returned;
        }
        pub fn err<T> (state: $State, err: StdError) -> StatefulResult<T> {
            Err(StatefulError((err, Some(state))))
        }
        pub fn err_msg<T> (state: $State, msg: &str) -> StatefulResult<T> {
            return err(state, StdError::GenericErr { msg: String::from(msg), backtrace: None })
        }
        pub fn err_auth<T> (state: $State) -> StatefulResult<T> {
            return err(state, StdError::Unauthorized { backtrace: None })
        }
        /// Transaction handlers
        mod handle {
            prelude!();
            use super::*;
            /// `ok!` is a variadic macro that takes up to 4 arguments:
            /// * `next`: the modified state to be saved
            /// * `msgs`: messages to return to the chain
            /// * `logs`: vector of `LogAttribute`s to log
            /// * `data`: blob of data to return
            macro_rules! ok {
                (_, $msgs:expr, $logs:expr, $data: expr) => {
                    Ok((HandleResponse { messages: $msgs, log: $logs, data: Some($data) }, None))
                };
                ($next:ident, $msgs:expr, $logs:expr, $data: expr) => {
                    Ok((HandleResponse { messages: $msgs, log: $logs, data: Some($data) }, Some($next)))
                };
                (_, $msgs:expr, $logs:expr) => {
                    Ok((HandleResponse { messages: $msgs, log: $logs, data: None }, None))
                };
                ($next:ident, $msgs:expr, $logs:expr) => {
                    Ok((HandleResponse { messages: $msgs, log: $logs, data: None }, Some($next)))
                };
                (_, $msgs:expr) => {
                    Ok((HandleResponse { messages: $msgs, log: vec![], data: None }, None))
                };
                ($next:ident, $msgs:expr) => {
                    Ok((HandleResponse { messages: $msgs, log: vec![], data: None }, Some($next)))
                };
                ($next:ident) => {
                    Ok((HandleResponse::default(), Some($next)))
                };
                () => {
                    Ok((HandleResponse::default(), None))
                };
            }
            // define a handler for every tx message variant
            $(#[allow(non_snake_case)] pub fn $Variant <S: Storage, A: Api, Q: Querier>(
                $deps: &mut Extern<S, A, Q>,
                $env:  Env,
                $msg:  msg::$Enum,
            ) -> HandleResult {
                // get mutable snapshot of current state:
                //let mut store: Singleton<'_, S, $State> =
                    //cosmwasm_storage::singleton(&mut $deps.storage, CONFIG_KEY);
                let mut store = get_store_rw(&mut $deps.storage);
                match store.load() {
                    Ok(mut $state) => {
                        // destructure the message
                        if let super::msg::$Enum::$Variant {$($arg),*} = $msg {
                            // perform user-specified actions
                            $body
                        } else {
                            unreachable!()
                        }
                    },
                    Err(e) => Err(e.into())
                }
            })*
        }
    };
}

/// Import commonly used things that need to be available everywhere in the contract
#[macro_export] macro_rules! prelude {
    () => { use cosmwasm_std::{
        Storage, Api, Querier, Extern, Env,
        HumanAddr, CanonicalAddr, Coin, Uint128,
        StdResult, StdError,
        InitResponse, HandleResponse, LogAttribute, Binary,
        CosmosMsg, BankMsg, WasmMsg, to_binary,
        log
    }; };
}

/// Define a smart contract
#[macro_export] macro_rules! contract {

    // This pattern matching is ugly!
    (
        // passed to `define_state_singleton!`
        [$State:ident]
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }

        // Define the signature of the init message, how it's handled.
        //
        $(#[$InitMeta:meta])*
        [$Init:ident]
        ( $init_deps:ident, $init_env:ident, $init_msg:ident : $($init_msg_definition:tt)+
        ) $init_body:block

        // Define query messages and how they're handled:
        [$Q:ident]
        ( $q_deps:ident, $q_state:ident, $q_msg:ident $( : $ExtQ:ident)? )
        -> $QResponse:ident { $(
            $(#[$QVariantMeta:meta])* $QVariant:ident
            ($($q_arg:ident $(: $q_arg_type:ty)?),*) $q_body:tt
        )* }

        // Define possible responses:
        [$Response:ident] {
        $( $(#[$response_meta:meta])* $ResponseMsg:ident { $($resp_field:ident : $resp_field_type:ty),* } )* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident, $tx_env:ident, $tx_state:ident, $tx_msg:ident $( : $ExtTX:ident)? )
        -> $TXResponse:ident { $(
            $(#[$TXVariantMeta:meta])* $TXVariant:ident
            ($($tx_arg:ident $(: $tx_arg_type:ty)?),*) $tx_body:tt
        )* }

    ) => {

        prelude!();

        /// WASM entry points.
        // Similar in spirit to [`create_entry_points`](https://docs.rs/cosmwasm-std/0.10.1/src/cosmwasm_std/entry_points.rs.html#49),
        // but doesn't need the implementation to be in a sibling module (the `super::contract` on L65)
        // TODO custom `migrate` for SecretNetwork
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            //use super::contract;
            use cosmwasm_std::{
                ExternalStorage as Storage, ExternalApi as Api, ExternalQuerier as Querier,
                do_init, do_handle, do_query
            };
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_init(&super::init::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_handle(&super::handle::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                do_query(&super::query::<Storage, Api, Querier>, msg_ptr,)
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }

        /// This contract's on-chain API.
        pub mod msg {
            // The argument sets of the {Init,Query,Handle}Msg handlers
            // are used to automatically generate the corresponding
            // protocol messages.
            // * This is why the @Q/@TX/@Response sub-sections are not just passed in as opaque `tt`s
            // * Only responses can't be inferred and need to be pre-defined.
            // * Although, with some more macro trickery, they could be defined in place
            //   (e.g. the return types of $Q handlers could be defined as
            //   `-> Foo { field: type }` and then populated with `return Self { field: value }`
            // * Let's revisit this once some we have some more examples of custom responses
            //
            prelude!();

            use super::*;

            define_init_message!($Init, $($init_msg_definition)+);

            define_q_messages!($Q, $($ExtQ,)? {
                $( $(#[$QVariantMeta])* $QVariant ($($q_arg $(: $q_arg_type)?),*))*
            });

            define_tx_messages!($TX, $($ExtTX,)? {
                $( $(#[$TXVariantMeta])* $TXVariant ($( $tx_arg $(: $tx_arg_type)?),*))*
            });

            messages!($Response { $(
                $(#[$response_meta])* $ResponseMsg {$($resp_field: $resp_field_type),*}
            )* });
        }

        /// Implementations
        //use msg::{$Init,$Q,$TX,$Response};

        define_state_singleton! {
            $State { $( $(#[$meta])* $state_field : $state_field_type ),* }
        }

        implement_init! {
            $(#[$InitMeta])* [$Init]
            ($init_deps, $init_env, $init_msg : $($init_msg_definition)+) $init_body
        }

        implement_queries! {
            $State, $($ExtQ,)? $Q ($q_deps, $q_state, $q_msg) -> $QResponse { $(
                $(#[$QVariantMeta])* $QVariant
                ($($q_arg $(: $q_arg_type)?),*) $q_body
            )* }
        }

        implement_transactions! {
            $State, $($ExtTX,)? $TX ($tx_deps, $tx_env, $tx_state, $tx_msg) -> $TXResponse { $(
                $(#[$TXVariantMeta])* $TXVariant
                ($( $tx_arg $(: $tx_arg_type)?),*) $tx_body
            )* }
        }

    };

}

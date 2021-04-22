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

/// Instatiation. Either defines or imports `InitMsg`, and hooks up your init logic to it.
#[macro_export] macro_rules! implement_init {
    // define the InitMsg in place:
    (   $(#[$InitMeta:meta])*
        [$Init:ident]
        ($deps:ident, $env:ident, $msg:ident :{ $($field:ident : $type:ty),* })
        $body:block
    ) => {
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
    (   $(#[$InitMeta:meta])*
        [init]
        ($deps:ident, $env:ident, $msg:ident : $external_msg:ty )
        $body:block
    ) => {
        $(#[$InitMeta])*
        pub fn init <S: Storage, A: Api, Q: Querier>(
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $external_msg
        ) -> StdResult<InitResponse> {
            // no auto-destructuring
            get_store_rw(&mut $deps.storage).save(&$body)?;
            Ok(InitResponse::default())
        }
    };
}

/// Query interface
#[macro_export] macro_rules! define_q_messages {
    ($msg_ext:ident, $body:tt) => { pub use super::$msg_ext; };
    //({ $(
        //$(#[$q_meta:meta])* $QMsg:ident ( $($q_field:ident : $q_field_type:ty),*)
        //$q_method_body:tt
    //)* }) => {
        //messages!($Q { $(
            //$(#[$q_meta])* $QMsg {$($q_field: $q_field_type),*}
        //)* }) };
}

/// Query implementations
#[macro_export] macro_rules! implement_queries {
    // for external query message type, ignore the name in the brackets
    // and pass through to the next macro variantb
    (   $State:ident, $Response:ident, $Enum:ident, $_:ident
        ( $deps:ident, $state:ident, $msg:ident ) $bodies:tt
    ) => {
        implement_queries!($State, $Response, $Enum ( $deps, $state, $msg ) $bodies);
    };
    // implement queries defined in $body
    (   $State:ident, $Response:ident, $Enum:ident
        ( $deps:ident, $state:ident, $msg:ident ) { $(
            $(#[$meta:meta])* $Variant:ident ( $($field:ident : $type:ty),*)
            $body:tt
        )*
    }) => {
        /// Query dispatcher.
        pub fn query <S: Storage, A: Api, Q: Querier> (
            $deps: &Extern<S, A, Q>, $msg: $Enum
        ) -> StdResult<Binary> {
            let state = get_store_ro(&$deps.storage).load()?; // get snapshot of contract state
            let result = match $msg { $( // find the matching handler
                $Enum::$Variant {..} => self::queries::$Variant($deps, state, $msg),
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
                    $deps: &Extern<S, A, Q>, $state: $State, $msg: $Enum,
                ) -> StdResult<$Response> {
                    if let super::$Enum::$Variant {$($field),*} = $msg { // destructure the message
                        $body // perform user-specified actions
                    } else { unreachable!() }
                }
            )*
        }

    }
}

/// Transaction interface
#[macro_export] macro_rules! define_tx_messages {
    ($tx_msg_ext:ident, $tx_body:tt) => { pub use super::$tx_msg_ext; };
    //({ $(
        //$(#[$tx_meta:meta])* $TXMsg:ident ($($tx_field:ident : $tx_field_type:ty),*)
        //$tx_method_body:tt )*
    //}) => {
        //messages!($TX { $(
            //$(#[$tx_meta])* $TXMsg {$($tx_field: $tx_field_type),*}
        //)* }) };
}

/// Transaction implementations
#[macro_export] macro_rules! implement_transactions {
    (   $State:ident, $Response:ident, $Enum:ident, $_:ident
        ($deps:ident, $env:ident, $state:ident, $msg:ident) $bodies:tt
    ) => {
        implement_transactions!($State, $Response, $Enum ($deps, $env, $state, $msg) $bodies);
    };
    (   $State:ident, $Response:ident, $Enum:ident
        ($deps:ident, $env:ident, $state:ident, $msg:ident) {
            $($Variant:ident ( $($arg:ident : $type:ty)* ) $body:block)*
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
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $Enum,
        ) -> StdResult<HandleResponse> {
            // pick the handler that matches the message and call it:
            let result = match $msg {
                $( $Enum::$Variant {..} => self::handle::$Variant($deps, $env, $msg), )*
            };
            // separate the state from the rest of the result
            let state: Option<$State>;
            let returned: StdResult<HandleResponse>;
            match result {
                Ok((response, next_state)) => {
                    state = next_state;
                    returned = Ok(response);
                },
                Err(StatefulError((error, next_state))) => {
                    state = next_state;
                    returned = Err(error);
                }
            }
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
                $msg:  $Enum,
            ) -> HandleResult {
                // get mutable snapshot of current state:
                //let mut store: Singleton<'_, S, $State> =
                    //cosmwasm_storage::singleton(&mut $deps.storage, CONFIG_KEY);
                let mut store = get_store_rw(&mut $deps.storage);
                match store.load() {
                    Ok(mut $state) => {
                        // destructure the message
                        if let super::$Enum::$Variant {$($field),*} = $msg {
                            // perform user-specified actions
                            $method_body
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

/// Define a smart contract
#[macro_export] macro_rules! contract {
    (
        // Define the shape of the local datastore.
        [$State:ident]
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }

        // Define the signature of the init message, how it's handled.
        // Must return and the initial state that an instance starts with.
        $(#[$InitMeta:meta])*
        [$Init:ident]
        ( $init_deps:ident, $init_env:ident, $init_msg:ident : $init_msg_definition:tt
        ) $init_body:block

        // Define query messages and how they're handled:
        [$Q:ident]
        ( $q_deps:ident, $q_state:ident, $q_msg:ident $( : $q_msg_external:ident)? )
        $q_body:tt

        // Define possible responses:
        [$Response:ident] {
        $( $(#[$response_meta:meta])* $ResponseMsg:ident { $($resp_field:ident : $resp_field_type:ty),* } )* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident, $tx_env:ident, $tx_state:ident, $tx_msg:ident $( : $tx_msg_external:ident)? )
        $tx_body:tt
    ) => {

        /// Import commonly used things that need to be available everywhere in the contract
        macro_rules! prelude {
            () => { use cosmwasm_std::{
                Storage, Api, Querier, Extern, Env,
                HumanAddr, CanonicalAddr, Coin, Uint128,
                StdResult, StdError,
                InitResponse, HandleResponse, LogAttribute, Binary,
                CosmosMsg, BankMsg, WasmMsg, to_binary
            }; };
        }

        prelude!();

        use msg::{$Init,$Q,$TX,$Response};

        define_state_singleton!(
            $State { $( $(#[$meta])* $state_field : $state_field_type ),* }
        );

        implement_init!(
            $(#[$InitMeta])* [$Init] ($init_deps, $init_env, $init_msg : $init_msg_definition)
            $init_body
        );

        implement_queries!(
            $State, $Response, $($q_msg_external,)?
            $Q ($q_deps, $q_state, $q_msg)
            $q_body
        );

        implement_transactions!(
            $State, $Response, $($tx_msg_external,)?
            $TX ($tx_deps, $tx_env, $tx_state, $tx_msg)
            $tx_body
        );

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
            prelude!();
            use super::*;
            define_init_message!($init_msg_definition);
            define_q_messages!($($q_msg_external,)?, $q_body);
            define_tx_messages!($($tx_msg_external,)?, $tx_body);
            messages!(
                $Response { $(
                    $(#[$response_meta])* $ResponseMsg {$($resp_field: $resp_field_type),*}
                )* }
            );
        }

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

    };

}

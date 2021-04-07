/// define an enum that implements the required traits
#[macro_export] macro_rules! message {
    ( $Msg:ident { $( $(#[$meta:meta])* $field:ident : $type:ty ),* } ) => {
        #[derive(serde::Serialize,serde::Deserialize,Clone,Debug,PartialEq,schemars::JsonSchema)]
        #[serde(rename_all = "snake_case")]
        pub struct $Msg { $( $(#[$meta])* pub $field: $type ),* } } }

/// define an enum with variants that implement the required traits
#[macro_export] macro_rules! messages {
    ( $( $Enum:ident { $( $(#[$meta:meta])* $Msg:ident { $( $field:ident : $type:ty ),* } )* } )*
    ) => { $(
        #[derive(serde::Serialize,serde::Deserialize,Clone,Debug,PartialEq,schemars::JsonSchema)]
        #[serde(rename_all = "snake_case")]
        pub enum $Enum { $( $(#[$meta])* $Msg { $($field : $type),* } ),* } )* } }

/// Provides the scaffolding for a smart contract.
#[macro_export] macro_rules! contract {
    // Entry point of the macro. Call this to define a contract
    (
        // Define the shape of the local datastore.
        [$State:ident]
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }

        // Define the signature of the init message, and how it's handled
        // and the initial state that an instance starts with.
        $(#[$InitMeta:meta])*
        [$Init:ident]
        ( $init_deps:ident
        , $init_env:ident
        , $init_msg:ident : { $($init_field:ident : $init_field_type:ty),* }
        ) $init_body:block

        // Define query messages and how they're handled:
        [$Q:ident]
        ( $q_deps:ident
        , $q_state:ident
        , $q_msg:ident)
        { $( $(#[$QMsgMeta:meta])* $QMsg:ident ($($q_field:ident : $q_field_type:ty),*) $q_method_body:tt )* }

        // Define possible responses:
        [$Response:ident]
        { $( $(#[$ResponseMeta:meta])* $ResponseMsg:ident { $($resp_field:ident : $resp_field_type:ty),* } )* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident
        , $tx_env:ident
        , $tx_state:ident
        , $tx_msg:ident )
        { $( $(#[$TXMsgMeta:meta])* $TXMsg:ident
             ($( $tx_field:ident : $tx_field_type:ty),*)
             $tx_method_body:tt )* }
    ) => {
        // import commonly used things that need to be available everywhere in the contract
        macro_rules! prelude {
            () => { use cosmwasm_std::{
                Storage, Api, Querier, Extern, Env,
                HumanAddr, CanonicalAddr, Coin, Uint128,
                StdResult, StdError,
                InitResponse, HandleResponse, LogAttribute, Binary,
                CosmosMsg, BankMsg, WasmMsg, to_binary }; }; }
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
            message!($Init { $($init_field: $init_field_type),* });
            messages!(
                $Q { $(
                    $(#[$QMsgMeta])* $QMsg {$($q_field: $q_field_type),*}
                )* }
                $TX { $(
                    $(#[$TXMsgMeta])* $TXMsg {$($tx_field: $tx_field_type),*}
                )* }
                $Response { $(
                    $(#[$ResponseMeta])* $ResponseMsg {$($resp_field: $resp_field_type),*}
                )* }
            );
        }
        use msg::{$Init,$Q,$TX,$Response};

        // WASM interface (entry point). Similar in spirit to `create_entry_points`:
        // https://docs.rs/cosmwasm-std/0.10.1/src/cosmwasm_std/entry_points.rs.html#49
        // but it doesn't need the `init/handle/query` trinity to be defined in a
        // separate sibling module (the `super::contract` on line 65 of `entry_points.rs`)
        // TODO optionally support `migrate`?
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

        prelude!();

        /// The contract's state.
        message!($State { $($(#[$meta])* $state_field:$state_field_type),* });
        use cosmwasm_storage::{Singleton, singleton, ReadonlySingleton, singleton_read};
        pub static CONFIG_KEY: &[u8] = b"";
        pub fn get_store_rw<S: Storage>(storage: &mut S) -> Singleton<S, $State> {
            singleton(storage, CONFIG_KEY)
        }
        pub fn get_store_ro<S: Storage>(storage: &S) -> ReadonlySingleton<S, $State> {
            singleton_read(storage, CONFIG_KEY)
        }

        /// Handle init message.
        $(#[$InitMeta])*
        pub fn init<S: Storage, A: Api, Q: Querier>(
            $init_deps: &mut Extern<S, A, Q>, $init_env: Env, $init_msg: $Init,
        ) -> InitResult {
            $(let $init_field : $init_field_type = $init_msg.$init_field;)*
            get_store_rw(&mut $init_deps.storage).save(&$init_body)?;
            Ok(InitResponse::default())
        }
        type InitResult = StdResult<InitResponse>;

        /// Query dispatcher.
        pub fn query <S: Storage, A: Api, Q: Querier> (
            $q_deps: &Extern<S, A, Q>, $q_msg: $Q
        ) -> StdResult<Binary> {
            // get a read-only snapshot of the contract state
            let state = get_store_ro(&$q_deps.storage).load()?;
            // find the matching handler and return
            let result = match $q_msg {
                $( $Q::$QMsg {..} => self::queries::$QMsg($q_deps, state, $q_msg), )*
            };
            Ok(cosmwasm_std::to_binary(&result?)?)
        }
        /// Query handlers.
        mod queries {
            prelude!();
            use super::*;
            use super::msg::$Response;
            // define a handler for every query message variant
            $(#[allow(non_snake_case)] pub fn $QMsg <S: Storage, A: Api, Q: Querier>(
                $q_deps: &Extern<S, A, Q>, $q_state: $State, $q_msg: $Q,
            ) -> StdResult<$Response> {
                // destructure the message
                if let super::$Q::$QMsg {$($q_field),*} = $q_msg {
                    // perform user-specified actions
                    $q_method_body
                } else {
                    unreachable!()
                }
            })*
        }

        /// Ok/Err variants containing mutated state to be saved
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
            $tx_deps: &mut Extern<S, A, Q>, $tx_env: Env, $tx_msg: $TX,
        ) -> StdResult<HandleResponse> {
            // pick the handler that matches the message and call it:
            let result = match $tx_msg {
                $( $TX::$TXMsg {..} => self::handle::$TXMsg($tx_deps, $tx_env, $tx_msg), )*
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
                let mut store = get_store_rw(&mut $tx_deps.storage);
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
            $(#[allow(non_snake_case)] pub fn $TXMsg <S: Storage, A: Api, Q: Querier>(
                $tx_deps: &mut Extern<S, A, Q>,
                $tx_env:  Env,
                $tx_msg:  $TX,
            ) -> HandleResult {
                // get mutable snapshot of current state:
                //let mut store: Singleton<'_, S, $State> =
                    //cosmwasm_storage::singleton(&mut $deps.storage, CONFIG_KEY);
                let mut store = get_store_rw(&mut $tx_deps.storage);
                match store.load() {
                    Ok(mut $tx_state) => {
                        // destructure the message
                        if let super::$TX::$TXMsg {$($tx_field),*} = $tx_msg {
                            // perform user-specified actions
                            $tx_method_body
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

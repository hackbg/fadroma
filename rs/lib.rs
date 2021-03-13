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
        $state_body:tt

        // Define the signature of the init message,
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
        { $($QMsg:ident ($($q_field:ident : $q_field_type:ty),*) $q_msg_body:tt )* }

        // Define possible responses:
        [$Response:ident]
        { $($ResponseMsg:ident { $($resp_field:ident : $resp_field_type:ty),* })* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident
        , $tx_env:ident
        , $tx_state:ident
        , $tx_msg:ident )
        { $( $(#[$TXMsgMeta:meta])* $TXMsg:ident
             ($( $tx_field:ident : $tx_field_type:ty),*)
             $tx_msg_body:tt )* }
    ) => {
        /// import commonly used things that need to be available everywhere in the contract
        macro_rules! prelude {
            () => { pub use cosmwasm_std::{
                Storage, Api, Querier, Extern, Env,
                HumanAddr, CanonicalAddr, Coin, Uint128,
                StdResult, StdError,
                InitResponse, HandleResponse, LogAttribute, Binary,
                CosmosMsg, BankMsg }; }; }
        /// This contract's on-chain API.
        pub mod msg {
            // * The argument sets of the {Init,Query,Handle}Msg handlers
            //   are used to automatically generate the corresponding
            //   protocol messages.
            //   * This is why the @Q/@TX/@Response sub-sections are not just passed in as opaque `tt`s
            //   * Only responses can't be inferred and need to be pre-defined.
            //   * Although, with some more macro trickery, they could be defined in place
            //     (e.g. the return types of $Q handlers could be defined as
            //     `-> Foo { field: type }` and then populated with `return Self { field: value }`
            //   * Let's revisit this once some we have some more examples of custom responses
            message!($Init { $($init_field: $init_field_type),* });
            messages!(
                $Q        { $( $QMsg {$($q_field: $q_field_type),*} )* }
                $TX       { $( $(#[$TXMsgMeta])* $TXMsg {$($tx_field: $tx_field_type),*} )* }
                $Response { $( $ResponseMsg {$($resp_field: $resp_field_type),*} )* }
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
            use super::{init, handle, query};
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_init(&init::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_handle(&handle::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                do_query(&query::<Storage, Api, Querier>, msg_ptr,)
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }

        prelude!();
        use cosmwasm_storage::singleton;
        contract!(@State; $State $state_body);
        contract!(@Init; $(#[$InitMeta])* [$Init]
            ($init_deps, $init_env, $init_msg : { $($init_field : $init_field_type),* })
            $init_body);
        contract!(@Q; $Q ( $q_deps, $q_state: $State, $q_msg ) -> $Response
            { $( $QMsg ($($q_field:$q_field_type),*) $q_msg_body )* });
        contract!(@TX; $TX ($tx_deps, $tx_env, $tx_state: $State, $tx_msg)
            { $( $TXMsg ( $($tx_field:$tx_field_type),* ) $tx_msg_body )* });

    };

    (@State; // define the state struct and methods to access it
        $State:ident
        { $( $(#[$meta:meta])* $Key:ident : $Type:ty ),* }
    ) => {
        /// The contract's state.
        message!($State { $($(#[$meta])* $Key:$Type),* });
        use cosmwasm_storage::{Singleton, ReadonlySingleton, singleton_read};
        pub static CONFIG_KEY: &[u8] = b"";
        pub fn get_store_rw<S: Storage>(storage: &mut S) -> Singleton<S, $State> {
            singleton(storage, CONFIG_KEY)
        }
        pub fn get_store_ro<S: Storage>(storage: &S) -> ReadonlySingleton<S, $State> {
            singleton_read(storage, CONFIG_KEY)
        }
    };

    (@Init; // define the handler for the init message
        $(#[$meta:meta])* [$Init:ident]
        ( $deps:ident, $env:ident, $msg:ident : { $($field:ident : $field_type:ty),* })
        $body:block
    ) => {
        /// Handle init message.
        $(#[$meta])*
        pub fn init<S: Storage, A: Api, Q: Querier>(
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $Init,
        ) -> InitResult {
            get_store_rw(&mut $deps.storage).save(&$body)?;
            Ok(InitResponse::default())
        }
        type InitResult = StdResult<InitResponse>;
    };

    (@Q; // define query message variants and their handlers
        $Q:ident ($deps:ident, $state:ident : $State:ty, $msg:ident) -> $Response:ident
        { $($Msg:ident ( $($field:ident : $field_type:ty),* ) $method_body:block)* }
    ) => {
        /// Query dispatcher.
        pub fn query <S: Storage, A: Api, Q: Querier> (
            $deps: &Extern<S, A, Q>, $msg: $Q
        ) -> StdResult<Binary> {
            // get a read-only snapshot of the contract state
            let $state = get_store_ro(&$deps.storage).load()?;
            // find the matching handler and return
            // TODO remove the `to_binary`/make it optional?
            let result = cosmwasm_std::to_binary(&match $msg {
                $( $Q::$Msg {..} => self::query::$Msg($deps, $state, $msg), )*
            })?;
            Ok(result)
        }
        mod query {
            prelude!();
            use super::*;
            use super::msg::$Response;
            // define a handler for every query message variant
            $(pub fn $Msg <S: Storage, A: Api, Q: Querier>(
                $deps: &Extern<S, A, Q>, $state: $State, $msg: $Q,
            ) -> $Response {
                // destructure the message
                if let super::$Q::$Msg {$($field),*} = $msg {
                    // perform user-specified actions
                    $method_body
                } else {
                    unreachable!()
                }
            })*
        }
    };

    (@TX; // define transaction message variants and their handlers
        $TX:ident ( $deps:ident, $env:ident, $state:ident : $State:ty, $msg:ident )
        { $($Msg:ident ( $($field:ident : $field_type:ty),* ) $method_body:block)* }
    ) => {
        /// Error type containing mutated state that will be saved
        pub struct HandleError((StdError, Option<$State>));
        impl From<StdError> for HandleError {
            /// **WARNING**: if `?` operator returns error, any state changes will be ignored
            /// * That's where the abstraction leaks, if only a tiny bit.
            ///   * Maybe implement handlers as closures that keep the state around.
            fn from (error: StdError) -> Self {
                HandleError((error, None))
            }
        }
        /// Result type containing mutated state that will be saved
        pub type HandleResult = Result<(HandleResponse, Option<$State>), HandleError>;
        /// Transaction dispatcher
        pub fn handle <S: Storage, A: Api, Q: Querier> (
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $TX,
        ) -> StdResult<HandleResponse> {
            // pick the handler that matches the message and call it:
            let result = match $msg {
                $( $TX::$Msg {..} => self::handle::$Msg($deps, $env, $msg), )*
            };
            // separate the state from the rest of the result
            let state: Option<$State>;
            let returned: StdResult<HandleResponse>;
            match result {
                Ok((response, next_state)) => {
                    state = next_state;
                    returned = Ok(response);
                },
                Err(HandleError((error, next_state))) => {
                    state = next_state;
                    returned = Err(error);
                }
            }
            // if there was a state update in the result, save it now
            if let Some(state) = state {
                let mut store = cosmwasm_storage::singleton(&mut $deps.storage, CONFIG_KEY);
                store.save(&state)?;
            }
            return returned;
        }
        mod handle {
            prelude!();
            use super::*;
            /// `ok!` is a variadic macro that takes up to 4 arguments:
            /// * `next`: the modified state to be saved
            /// * `msgs`: messages to return to the chain
            /// * `logs`: custom data to log
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
            $(pub fn $Msg <S: Storage, A: Api, Q: Querier>(
                $deps: &mut Extern<S, A, Q>,
                $env:  Env,
                $msg:  $TX,
            ) -> HandleResult {
                // get mutable snapshot of current state:
                //let mut store: Singleton<'_, S, $State> =
                    //cosmwasm_storage::singleton(&mut $deps.storage, CONFIG_KEY);
                let mut store = get_store_rw(&mut $deps.storage);
                match store.load() {
                    Ok(mut $state) => {
                        // destructure the message
                        if let super::$TX::$Msg {$($field),*} = $msg {
                            // perform user-specified actions
                            $method_body
                        } else {
                            unreachable!()
                        }
                    },
                    Err(e) => Err(e.into())
                }
            })*
            fn err (mut state: $State, err: StdError) -> HandleResult {
                state.errors += 1;
                Err(HandleError((err, Some(state))))
            }
            fn err_msg (mut state: $State, msg: &str) -> HandleResult {
                return err(state, StdError::GenericErr { msg: String::from(msg), backtrace: None })
            }
            fn err_auth (mut state: $State) -> HandleResult {
                return err(state, StdError::Unauthorized { backtrace: None })
            }
        }
    };

}

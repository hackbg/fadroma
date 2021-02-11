#[macro_export]
macro_rules! message {
    ( $pub:vis $Msg:ident {
        $(
            $(#[$meta:meta])*
            $field:ident : $type:ty
        ),*
    } ) => {
        #[derive(
            serde::Serialize, serde::Deserialize,
            Clone, Debug, PartialEq,
            schemars::JsonSchema
        )]
        $pub struct $Msg {
            $(
                $(#[$meta])*
                $pub $field: $type
            ),*
        }
    }
}

#[macro_export]
macro_rules! messages {
    (
        $( $group:ident {
            $($Msg:ident { $( $field:ident : $type:ty ),* })*
        } )*
    ) => { $(
        #[derive(
            serde::Serialize, serde::Deserialize,
            Clone, Debug, PartialEq,
            schemars::JsonSchema
        )]
        #[serde(rename_all = "snake_case")]
        pub enum $group { $($Msg { $($field : $type),* }),* }

        //$(message!($Msg { $($field: $type),* });)*
    )* }
}

#[macro_export]
macro_rules! contract {

    // Entry point of the macro.
    (
        // Define the shape of the local datastore
        // which is essentially a collection of singletons.
        [$State:ident] $state_body:tt

        // Define the signature of the init message,
        // and the initial state that an instance starts with.
        [$Init:ident] (
            $init_deps:ident,
            $init_env:ident,
            $init_msg:ident : {
                $($init_field:ident : $init_field_type:ty),*
            }
        ) $init_body:block

        // Define query messages and how they're handled
        [$Query:ident] (
            $query_deps:ident,
            $query_state:ident,
            $query_msg:ident
        ) {
            $($QueryMsg:ident ($(
                $query_field:ident : $query_field_type:ty
            ),*) $query_msg_body:tt)*
        }

        // Define possible query responses
        [$Response:ident] {
            $($ResponseMsg:ident { $(
                $resp_field:ident : $resp_field_type:ty
            ),* })*
        }

        // Define transaction messages and how they're handled
        [$Handle:ident] (
            $handle_deps:ident,
            $handle_env:ident,
            $handle_sender:ident,
            $handle_state:ident,
            $handle_msg:ident
        ) {
            $($HandleMsg:ident ($(
                $handle_field:ident : $handle_field_type:ty
            ),*) $handle_msg_body:tt)*
        }

    ) => {

        // This macro has several sub-sections.
        // (An earlier version, as published [here](https://github.com/hackbg/hello-secret-network/blob/97b85f426b07751a40e628d7d237155c335216b6/src/macros.rs)
        // has them implemented as separate macros.)
        // They are called in turn below:

        // First, create the `msg` submodule,
        // which is used for automatic schema generation.
        // It roughly represents the public interface of the contract.
        // This is why the sub-section parameters are not just passed down
        // as opaque `tt`s, but need to be expanded in the root section:
        /// This contract's API.
        pub mod msg {
            // The argument sets of the {Init,Query,Handle}Msg handlers
            // are used to automatically generate the corresponding
            // protocol messages; only responses can't be inferred.
            // TODO or can they?

            message!(pub $Init { $($init_field: $init_field_type),* });
            messages!(
                $Query {
                    $($QueryMsg {$($query_field: $query_field_type),*})*
                }
                $Handle {
                    $($HandleMsg {$($handle_field: $handle_field_type),*})*
                }
                $Response {
                    $($ResponseMsg {$($resp_field: $resp_field_type),*})*
                }
            );
        }
        use msg::{$Init,$Query,$Handle,$Response};

        // WASM interface (entry point)
        // This is mostly to be left alone.
        // TODO optionally support `migrate`?
        #[cfg(target_arch = "wasm32")]
        mod wasm {
            //use super::contract;
            use cosmwasm_std::{ExternalApi, ExternalQuerier, ExternalStorage};
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_init(
                    &super::init::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                cosmwasm_std::do_handle(
                    &super::handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr, msg_ptr,
                )
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                cosmwasm_std::do_query(
                    &super::query::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    msg_ptr,
                )
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }

        // See individual subsections for info on what they do:
        contract!(@State $State $state_body);

        contract!(@Init [$Init] (
            $init_deps,
            $init_env,
            $init_msg : { $($init_field : $init_field_type),* }
        ) $init_body);

        contract!(@Query [$Query -> $Response] (
            $query_deps,
            $query_state,
            $query_msg
        ) { $(
            $QueryMsg ($($query_field:$query_field_type),*)
                $query_msg_body
        )* });

        contract!(@Handle [$Handle $State] (
            $handle_deps,
            $handle_env,
            $handle_sender,
            $handle_state,
            $handle_msg
        ) { $(
            $HandleMsg ($($handle_field:$handle_field_type),*)
                $handle_msg_body
        )* });

        contract!(@HandleResults $State);

    };

    (@State $State:ident { $(
        $(#[$meta:meta])*
        $Key:ident : $Type:ty
    ),* }) => {
        /// The contract's state.
        message!(pub $State {
            $($(#[$meta])* $Key:$Type),*
        });
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

    (@Init [$Init:ident] (
        $deps:ident,
        $env:ident,
        $msg:ident : { $($field:ident : $field_type:ty),* }
    ) $body:block) => {

        type InitResult =
            cosmwasm_std::StdResult<cosmwasm_std::InitResponse>;

        /// Handle initialization.
        pub fn init<
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        >(
            $deps: &mut cosmwasm_std::Extern<S, A, Q>,
            $env:  cosmwasm_std::Env,
            $msg:  $Init,
        ) -> InitResult {
            match get_state_rw(&mut $deps.storage).save(&$body) {
                Err(e) => Err(e),
                Ok (_) => Ok(cosmwasm_std::InitResponse::default())
            }
        }
    };

    // PATTERN:
    // Simulated "closures" (lexical contexts) provide a familiar interface
    // over simulated "methods" (`match` branches) whose arguments are
    // simultaneously the type definition for its corresponding message.
    // This is used both in Query and Handle with slightly different scopes.

    // Free stateless queries
    (@Query [$Query:ident -> $Response:ident] ( // arrow is just for clarity
        $deps:ident,
        $state:ident,
        $msg:ident
    ) {
        $($Msg:ident ( $($field:ident : $field_type:ty),* ) $USER:block)*
    }) => {

        type BinaryResult =
            cosmwasm_std::StdResult<cosmwasm_std::Binary>;

        /// Handle read-only queries.
        pub fn query <
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        > (
            $deps: &cosmwasm_std::Extern<S, A, Q>,
            $msg:  $Query
        ) -> BinaryResult {
            match $msg {
                $($Query::$Msg { $($field,)* } => {
                    let $state = get_state_ro(&$deps.storage).load()?;
                    return cosmwasm_std::to_binary(&$USER);
                },)*
            };
        }

    };

    // Stateful transactions
    (@Handle [$Handle:ident $State:ident] (
        $deps:ident,
        $env:ident,
        $sender:ident,
        $state:ident,
        $msg:ident
    ) {
        $($Msg:ident ( $($field:ident : $field_type:ty),* ) $USER:block)*
    }) => {

        type HandleResult =
            cosmwasm_std::StdResult<cosmwasm_std::HandleResponse>;

        /// Handle transactions.
        pub fn handle <
            S: cosmwasm_std::Storage,
            A: cosmwasm_std::Api,
            Q: cosmwasm_std::Querier
        > (
            $deps: &mut cosmwasm_std::Extern<S, A, Q>,
            $env:  cosmwasm_std::Env,
            $msg:  $Handle,
        ) -> HandleResult {
            let $sender = $deps.api.canonical_address(
                &$env.message.sender
            )?;
            let mut store = cosmwasm_storage::singleton(
                &mut $deps.storage,
                CONFIG_KEY
            );
            let mut $state: State = store.load()?;
            let (new_state, result) = match $msg {
                $($Handle::$Msg { $($field),* } => $USER,)*
            };
            store.save(&new_state).unwrap();
            result
        }

    };

    (@HandleResults $State:ident) => {

        type StatefulHandleResult =
            ($State, cosmwasm_std::StdResult<cosmwasm_std::HandleResponse>);

        fn ok (
            state: $State
        ) -> StatefulHandleResult {
            (state, Ok(cosmwasm_std::HandleResponse::default()))
        }

        fn ok_msg (
            state:    $State,
            messages: Vec<cosmwasm_std::CosmosMsg>
        ) -> StatefulHandleResult {
            (state, Ok(cosmwasm_std::HandleResponse {
                log: vec![], data: None, messages
            }))
        }

        fn ok_send (
            state:        $State,
            from_address: cosmwasm_std::HumanAddr,
            to_address:   cosmwasm_std::HumanAddr,
            amount:       Vec<cosmwasm_std::Coin>
        ) -> StatefulHandleResult {
            let msg = cosmwasm_std::BankMsg::Send {
                from_address,
                to_address,
                amount
            };
            ok_msg(state, vec![ cosmwasm_std::CosmosMsg::Bank(msg) ])
        }

        fn err_msg (
            mut state: $State,
            msg:       &str
        ) -> StatefulHandleResult {
            state.errors += 1;
            (state, Err(cosmwasm_std::StdError::GenericErr {
                msg: String::from(msg),
                backtrace: None
            }))
        }

        fn err_auth (
            mut state: $State
        ) -> StatefulHandleResult {
            state.errors += 1;
            (state, Err(cosmwasm_std::StdError::Unauthorized {
                backtrace: None
            }))
        }

    };

}

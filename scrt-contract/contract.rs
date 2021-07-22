//! # Fadroma SCRT Contract macro.
//!
//! Incorporates the actual syntactic structure of a SCRT contract implementation,
//! along with some extra amenities (global state), in order to generate a contract
//! implementation from user-provided function names/args/bodies.

pub mod contract_msg;
pub mod contract_binding;
pub mod contract_init;
pub mod contract_query;
pub mod contract_handle;
pub mod contract_state;

/// Import commonly used definitions that need to be available everywhere in the contract
#[macro_export] macro_rules! prelude {
    () => { use fadroma::scrt::cosmwasm_std::{
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

    (
        // global state: considering deprecation
        // passed to `contract_state::define_state_singleton!`
        [$State:ident] // name of state struct, followed by state fields
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }

        // Define the signature of the init message, and how it's handled.
        $(#[$InitMeta:meta])*
        [$Init:ident]
        ( $init_deps:ident, $init_env:ident, $init_msg:ident : $($init_msg_definition:tt)+)
            $init_body:block

        // Define query messages and how they're handled:
        [$Q:ident]
        ( $q_deps:ident, $q_state:ident, $q_msg:ident $( : $ExtQ:ident)? )
            -> $QResponse:ident { $(
                $(#[$QVariantMeta:meta])* $QVariant:ident ($(
                    $(#[$QVariantArgMeta:meta])* $q_arg:ident $(: $q_arg_type:ty)?
                ),*) $q_body:tt
            )* }

        // Define possible query responses:
        [$Response:ident] {
        $( $(#[$response_meta:meta])* $ResponseMsg:ident { $($resp_field:ident : $resp_field_type:ty),* } )* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident, $tx_env:ident, $tx_state:ident, $tx_msg:ident $( : $ExtTX:ident)? )
            -> $TXResponse:ident { $(
                $(#[$TXVariantMeta:meta])* $TXVariant:ident ($(
                    $(#[$TXVariantArgMeta:meta])* $tx_arg:ident $(: $tx_arg_type:ty)?
                ),*) $tx_body:tt
            )* }

    ) => {

        /// Import common platform types.
        prelude!();

        /// Entry point when building for blockchain.
        #[cfg(all(not(feature = "browser"), target_arch = "wasm32"))]
        bind_chain!(super);

        /// Entry point when building for browser.
        #[cfg(all(feature = "browser", target_arch = "wasm32"))]
        bind_js!(
            super,
            super::msg::$Init,
            super::msg::$TX,
            super::msg::$Q,
            super::msg::$Response
        );

        /// This contract's API schema.
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
                $( $(#[$QVariantMeta])* $QVariant ($(
                    $(#[$QVariantArgMeta])*
                    $q_arg $(: $q_arg_type)?
                ),*))*
            });
            define_tx_messages!($TX, $($ExtTX,)? {
                $( $(#[$TXVariantMeta])* $TXVariant ($(
                    $(#[$TXVariantArgMeta])*
                    $tx_arg $(: $tx_arg_type)?),*
                ))*
            });
            messages!($Response { $(
                $(#[$response_meta])* $ResponseMsg {$($resp_field: $resp_field_type),*}
            )* });
        }

        /// Implementations
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

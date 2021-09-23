//! # Fadroma SCRT Contract macro.
//!
//! Incorporates the actual syntactic structure of a SCRT contract implementation,
//! along with some extra amenities (global state), in order to generate a contract
//! implementation from user-provided function names/args/bodies.

/// Import commonly used definitions that need to be available everywhere in the contract
#[macro_export] macro_rules! prelude {
    () => { use fadroma::scrt::cosmwasm_std::{
        ReadonlyStorage, Storage, Api, Querier, Extern, Env,
        Addr, CanonicalAddr, Coin, Uint128,
        StdResult, StdError,
        InitResponse, HandleResponse, LogAttribute, Binary,
        CosmosMsg, BankMsg, WasmMsg, to_binary,
        log
    }; };
}

/// Define a smart contract
#[macro_export] macro_rules! contract {

    (
        // global state: passed to `contract_state::define_state_singleton!`
        // considering deprecation in favor of fadroma_scrt_storage
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
        $( $(#[$response_meta:meta])* $ResponseMsg:ident {
            $($(#[$response_field_meta:meta])* $resp_field:ident : $resp_field_type:ty),* } )* }

        // Define transaction messages and how they're handled:
        [$TX:ident]
        ( $tx_deps:ident, $tx_env:ident, $tx_state:ident, $tx_msg:ident $( : $ExtTX:ident)? )
            -> $TXResponse:ident { $(
                $(#[$TXVariantMeta:meta])* $TXVariant:ident ($(
                    $(#[$TXVariantArgMeta:meta])* $tx_arg:ident $(: $tx_arg_type:ty)?
                ),*) $tx_body:tt
            )* }

        // Q and TX are basically `Readonly` and `Writable`
        // so the future `struct Contract` might implement those directly
        // to collapse one more layer of the API

    ) => {

        /// Imports common platform types into the module.
        prelude!();

        #[cfg(all(not(feature = "browser"), target_arch = "wasm32"))]
        /// Entry points for running this contract on a blockchain (testnet or mainnet).
        /// Build with `features = ["fadroma/browser"]` to build for browser instead.
        mod wasm {
            crate::bind_chain!(super);
        }

        #[cfg(all(feature = "browser", target_arch = "wasm32"))]
        /// Entry point for running this contract in a browser using `wasm-pack`/`wasm-bindgen`.
        /// Build without `features = ["fadroma/browser"]` to build for blockchain instead.
        mod wasm {
            crate::bind_js!(super);
        }

        /// Contains the contract's API schema.
        ///
        /// `fadroma_scrt_contract` automatically generates this module
        /// containing the protocol messages determined by the argument sets
        /// of the methods specified by the user of the `contract!` macro.
        ///
        // * This is why the @Q/@TX/@Response sub-sections are not just passed as opaque `tt`s
        // * Only responses can't be inferred and need to be pre-defined.
        // * Although, with some more macro trickery, they could be defined in place
        //   (e.g. the return types of $Q handlers could be defined as
        //   `-> Foo { field: type }` and then populated with `return Self { field: value }`
        // * Let's revisit this once some we have some more examples of custom responses
        pub mod msg {
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
                $(#[$response_meta])* $ResponseMsg {
                    $($(#[$response_field_meta])* $resp_field: $resp_field_type),*
                }
            )* });
        }

        // Lol how the hell did this `crate::` path work

        // Generate the implementations from user-provided code.

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

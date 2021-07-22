/// Query interface.
#[macro_export] macro_rules! define_q_messages {
    // if imported:
    ($_1:tt, $Import:ident, { $($_2:tt)* }) => { pub use super::$Import; };
    // if defined in place:
    ($Name:ident, { $(
        $(#[$meta:meta])* $Variant:ident ( $(
            $(#[$arg_meta:meta])* $arg:ident : $type:ty
        ),* )
    )* }) => {
        messages!($Name { $( $(#[$meta])* $Variant {$(
            $(#[$arg_meta])* $arg: $type
        ),*} )* });
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
            Ok(fadroma::scrt::cosmwasm_std::to_binary(&result?)?) // return handler result
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

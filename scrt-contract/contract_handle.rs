/// Transaction interface.
#[macro_export] macro_rules! define_tx_messages {
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
        /// Transaction dispatcher
        pub fn handle <S: Storage, A: Api, Q: Querier> (
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: msg::$Enum,
        ) -> StdResult<HandleResponse> {
            // pick the handler that matches the message and call it:
            match $msg { $(
                msg::$Enum::$Variant {..} => self::handle::$Variant($deps, $env, $msg),
            )* }
        }
        /// Transaction handlers
        mod handle {
            prelude!();
            use super::*;
            // shorthand for saving state
            // define a handler for every tx message variant
            $(#[allow(non_snake_case)] pub fn $Variant <S: Storage, A: Api, Q: Querier>(
                $deps: &mut Extern<S, A, Q>,
                $env:  Env,
                $msg:  msg::$Enum,
            ) -> StdResult<HandleResponse> {
                // get mutable snapshot of current state:
                let mut $state = get_store_rw(&mut $deps.storage).load()?;
                macro_rules! save_state {
                    () => { get_store_rw(&mut $deps.storage).save(&$state)?; }
                };
                if let super::msg::$Enum::$Variant {$($arg),*} = $msg {
                    // perform user-specified actions
                    $body
                } else {
                    unreachable!()
                }
            })*
        }
    };
}


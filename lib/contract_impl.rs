/// Instatiation. Either defines or imports an `InitMsg`, and hooks up your init logic to it.
/// Function body must return the initial value of `State`.
#[cfg(feature="scrt-contract")]
#[macro_export] macro_rules! implement_init {

    // When the InitMsg has been defined in place:
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
            macro_rules! save_state {
                // Storing the global state of the contract with this macro
                ($global_state:expr) => { get_store_rw(&mut $deps.storage).save(&$global_state)?; }
            };
            Ok($body)
        }
    };

    // When you `use` an InitMsg defined in an external module
    // (e.g. a shared API crate that defines the interface for multiple subcomponents):
    (
        $(#[$InitMeta:meta])* [$_:ident]
        ($deps:ident, $env:ident, $msg:ident : $InitExt:ty ) $body:block
    ) => {
        $(#[$InitMeta])*
        pub fn init <S: Storage, A: Api, Q: Querier>(
            $deps: &mut Extern<S, A, Q>, $env: Env, $msg: $InitExt
        ) -> StdResult<InitResponse> {
            // no auto-destructuring because the macro is not aware of the struct fields
            macro_rules! save_state {
                // Storing the global state of the contract with this macro
                ($global_state:expr) => { get_store_rw(&mut $deps.storage).save(&$global_state)?; }
            };
            $body;
            Ok(InitResponse::default())
        }
    };

}

#[cfg(feature="terra-contract")]
#[macro_export] macro_rules! implement_init {

    // When the InitMsg has been defined in place:
    (
        $(#[$InitMeta:meta])* [$Instantiate:ident]
        ($deps:ident, $env:ident, $info:ident, $msg:ident :{ $($field:ident : $type:ty),* }) $body:block
    ) => {
        use msg::$Instantiate;
        $(#[$InitMeta])*
        pub fn instantiate (
            mut $deps: DepsMut, $env: Env, $info: MessageInfo, $msg: $Instantiate
        ) -> Result<CwResponse, ContractError> {
            $(let $field : $type = $msg.$field;)*
            macro_rules! save_state {
                // Storing the global state of the contract with this macro
                ($global_state:expr) => { CONFIG.save($deps.storage, &$global_state)?; }
            };
            Ok($body)
        }
    };

    // When you `use` an InitMsg defined in an external module
    // (e.g. a shared API crate that defines the interface for multiple subcomponents):
    (
        $(#[$InitMeta:meta])* [$_:ident]
        ($deps:ident, $env:ident, $info:ident, $msg:ident : $InitExt:ty ) $body:block
    ) => {
        $(#[$InitMeta])*
        pub fn instantiate (
            $deps: DepsMut, $env: Env, $info: MessageInfo, $msg: $InitExt
        ) -> Result<CwResponse, ContractError> {
            // no auto-destructuring because the macro is not aware of the struct fields
            macro_rules! save_state {
                // Storing the global state of the contract with this macro
                ($global_state:expr) => { CONFIG.save($deps.storage, &$global_state)?; }
            };
            $body;
            Ok(Response::default())
        }
    };

}

/// Query implementations.
#[cfg(feature="scrt-contract")]
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

#[cfg(feature="terra-contract")]
#[macro_export] macro_rules! implement_queries {

    // for external query message type, ignore the name in the brackets
    // and pass through to the next macro variantb
    (
        $State:ident, $EnumExt:ident, $_:ident
        ( $deps:ident, $state:ident, $env:ident, $msg:ident ) -> $Response:ident { $($bodies:tt)* }
    ) => {
        implement_queries!($State, $EnumExt ( $deps, $state, $env, $msg ) -> $Response { $($bodies)* });
    };

    // implement queries defined in $body
    (
        $State:ident, $Enum:ident
        ( $deps:ident, $state:ident, $env:ident, $msg:ident ) -> $Response:ident { $(
            $(#[$meta:meta])* $Variant:ident ( $($field:ident : $type:ty),*)
            $body:tt
        )* }
    ) => {
        /// Query dispatcher.
        pub fn query (
            $deps: Deps, $env: Env, $msg: msg::$Enum
        ) -> Result<Binary, ContractError> {
            let state = CONFIG.load($deps.storage)?; // get snapshot of contract state
            let result = match $msg { $( // find the matching handler
                msg::$Enum::$Variant {..} => self::queries::$Variant($deps, state, $msg),
            )* };
            Ok(fadroma::terra::to_binary(&result?)?) // return handler result
        }
        /// Query handlers.
        mod queries {
            prelude!();
            pub use super::{*, msg::Response};
            // for every query message variant, define a handler
            $(
                $(#[$meta])*
                #[allow(non_snake_case)]
                pub fn $Variant (
                    $deps: Deps, $state: $State, $msg: msg::$Enum,
                ) -> Result<$Response, ContractError> {
                    if let super::msg::$Enum::$Variant {$($field),*} = $msg { // destructure the message
                        $body // perform user-specified actions
                    } else { unreachable!() }
                }
            )*
        }
    }

}

/// Transaction implementations
#[cfg(feature="scrt-contract")]
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


#[cfg(feature="terra-contract")]
#[macro_export] macro_rules! implement_transactions {

    (   $State:ident, $Enum:ident, $_:ident
        ($deps:ident, $env:ident, $info:ident, $state:ident, $msg:ident) -> $Response:ident { $($bodies:tt)* }
    ) => {
        implement_transactions!($State, $Enum ($deps, $env, $state, $msg) -> $Response { $($bodies)* });
    };

    (   $State:ident, $Enum:ident
        ($deps:ident, $env:ident, $info:ident, $state:ident, $msg:ident) -> $Response:ident {
            $($(#[$meta:meta])* $Variant:ident ( $($arg:ident $(: $type:ty)?),* ) $body:block)*
        }
    ) => {
        /// Transaction dispatcher
        pub fn execute(
            $deps: DepsMut, $env: Env, $info: MessageInfo, $msg: msg::$Enum,
        ) -> Result<CwResponse, ContractError> {
            // pick the handler that matches the message and call it:
            match $msg { $(
                msg::$Enum::$Variant {..} => self::execute::$Variant($deps, $env, $info, $msg),
            )* }
        }
        /// Transaction handlers
        mod execute {
            prelude!();
            use super::*;
            // shorthand for saving state
            // define a handler for every tx message variant
            $(#[allow(non_snake_case)] pub fn $Variant (
                $deps: DepsMut,
                $env:  Env,
                $info: MessageInfo,
                $msg:  msg::$Enum,
            ) -> Result<CwResponse, ContractError> {
                // get mutable snapshot of current state:
                let mut $state = CONFIG.load($deps.storage)?;
                macro_rules! save_state {
                    () => { CONFIG.save(deps.storage, &$state)?; }
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

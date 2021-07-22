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
            macro_rules! save_state {
                // Storing the global state of the contract with this macro
                ($global_state:expr) => { get_store_rw(&mut $deps.storage).save(&$global_state)?; }
            };
            Ok($body)
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

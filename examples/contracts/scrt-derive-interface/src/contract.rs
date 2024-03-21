use fadroma::{prelude::*, dsl::*};

pub mod interface;

pub use contract::*;

#[contract]
mod contract {
    use super::*;
    use interface::Counter;

    fadroma::namespace!(pub StateNs, b"state");
    pub const STATE: SingleItem<u64, StateNs> = SingleItem::new();

    impl Counter for Contract {
        type Error = StdError;

        #[init(entry_wasm)]
        fn new(initial_value: u64) -> Result<Response, Self::Error> {
            STATE.save(deps.storage, &initial_value)?;

            Ok(Response::default())
        }

        #[execute]
        fn add(value: u64) -> Result<Response, Self::Error> {
            let mut state = STATE.load_or_default(deps.storage)?;
            state += value;
    
            STATE.save(deps.storage, &state)?;
    
            Ok(Response::default())
        }

        #[execute]
        fn sub(value: u64) -> Result<Response, Self::Error> {
            let mut state = STATE.load_or_default(deps.storage)?;
            state -= value;
    
            STATE.save(deps.storage, &state)?;
    
            Ok(Response::default())
        }

        #[execute]
        fn mul(value: u64) -> Result<Response, Self::Error> {
            let mut state = STATE.load_or_default(deps.storage)?;
            state *= value;
    
            STATE.save(deps.storage, &state)?;
    
            Ok(Response::default())
        }

        #[execute]
        fn div(value: u64) -> Result<Response, Self::Error> {
            let mut state = STATE.load_or_default(deps.storage)?;
            state /= value;
    
            STATE.save(deps.storage, &state)?;
    
            Ok(Response::default())
        }

        #[query]
        fn value() -> Result<u64, Self::Error> {
            STATE.load_or_default(deps.storage)
        }
    }
}

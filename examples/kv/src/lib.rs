use fadroma::{prelude::*, dsl::*};

pub use contract::*;

#[contract]
mod contract {
    use super::*;

    fadroma::namespace!(StateNs, b"state");
    const STATE: ItemSpace::<String, StateNs, TypedKey<String>> = ItemSpace::new();

    impl Contract {
        #[init(entry)]
        pub fn new() -> Result<Response, StdError> {
            Ok(Response::default())
        }

        #[query]
        pub fn get(key: String) -> Result<Option<String>, StdError> {
            STATE.load(deps.storage, &key)
        }

        #[execute]
        pub fn set(key: String, value: String) -> Result<Response, StdError> {
            STATE.save(deps.storage, &key, &value)?;
            Ok(Response::default())
        }

        #[execute]
        pub fn del(key: String) -> Result<Response, StdError> {
            STATE.remove(deps.storage, &key);
            Ok(Response::default())
        }
    }
}

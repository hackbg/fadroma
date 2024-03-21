#[fadroma::dsl::contract]
pub mod product {
    use fadroma::{dsl::*, prelude::*};
    use fadroma_example_factory_shared::*;
    impl Product for Contract {
        type Error = StdError;

        #[init(entry_wasm)]
        fn new() -> Result<Response, <Self as Product>::Error> {
            Ok(Response::default().set_data(to_binary(&env.contract.address)?))
        }
    }
}

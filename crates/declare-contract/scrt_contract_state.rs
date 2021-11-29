//! Inefficient, use <../fadroma_scrt_storage> instead

/// Define the state singleton.
// TODO: Support other shapes of state
#[macro_export] macro_rules! define_state_singleton {
    (
        $State:ident
        { $( $(#[$meta:meta])* $state_field:ident : $state_field_type:ty ),* }
    ) => {
        /// State singleton
        message!($State { $($(#[$meta])* $state_field:$state_field_type),* });
        use fadroma::scrt::{Singleton, singleton, ReadonlySingleton, singleton_read};
        pub static CONFIG_KEY: &[u8] = b"fadroma_root_state";
        pub fn get_store_rw<S: Storage>(storage: &mut S) -> Singleton<S, $State> {
            singleton(storage, CONFIG_KEY)
        }
        pub fn get_store_ro<S: Storage>(storage: &S) -> ReadonlySingleton<S, $State> {
            singleton_read(storage, CONFIG_KEY)
        }
    }
}

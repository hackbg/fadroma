#[cfg(feature="scrt")]

#[cfg(feature="scrt")]
pub mod scrt {
    pub use fadroma_scrt_base::*;

    #[cfg(feature="scrt-storage")]
    pub use fadroma_scrt_storage  as storage;

    #[cfg(feature="scrt-callback")]
    pub use fadroma_scrt_callback as callback;

    #[cfg(feature="scrt-contract")]
    pub use fadroma_scrt_contract as contract;

    #[cfg(feature="scrt-migrate")]
    pub use fadroma_scrt_migrate  as migrate;
}

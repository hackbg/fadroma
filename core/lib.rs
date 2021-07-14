#[cfg(feature="scrt")]
pub mod scrt {
    pub use fadroma_scrt_base::*;

    #[cfg(feature="scrt-addr")]
    pub use fadroma_scrt_addr as addr;

    #[cfg(feature="scrt-storage")]
    pub use fadroma_scrt_storage as storage;

    #[cfg(feature="scrt-callback")]
    pub use fadroma_scrt_callback as callback;

    #[cfg(feature="scrt-contract")]
    pub use fadroma_scrt_contract as contract;

    #[cfg(feature="scrt-harness")]
    pub use fadroma_scrt_harness as harness;

    #[cfg(feature="scrt-migrate")]
    pub use fadroma_scrt_migrate as migrate;

    #[cfg(feature="scrt-snip20-api")]
    pub use fadroma_scrt_snip20_api as snip20_api;

    #[cfg(feature="scrt-utils")]
    pub use fadroma_scrt_utils as utils;
}

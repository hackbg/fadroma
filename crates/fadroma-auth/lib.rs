pub mod admin;
pub use admin::{
    Admin,
    load_admin,
    save_admin,
    load_pending_admin,
    save_pending_admin,
    assert_admin
    // ...but not InitMsg, HandleMsg, or QueryMsg,
    // because those would clash with the contract's messages
    // in the case of a glob import (`use fadroma::*`).
    // If you need those, `use fadroma::admin::{InitMsg, ...}`
};

pub mod permit;
pub use permit::*;

pub mod vk;
pub use vk::*;

pub mod vk_auth;
pub use vk_auth::*;

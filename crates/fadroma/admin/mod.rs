//! Transaction authentication by pre-configured admin address.
//! See the [examples](https://github.com/hackbg/fadroma/tree/master/examples) on how to implement it.

pub use fadroma_proc_auth::*;

use serde::{Serialize, Deserialize};

use crate::{
    dsl::*,
    core::Canonize,
    storage::SingleItem,
    schemars::JsonSchema,
    cosmwasm_std::{
        self,
        Deps, DepsMut, Response, MessageInfo,
        CanonicalAddr, StdResult, StdError, Addr
    }
};

crate::namespace!(pub AdminNs, b"ltp5P6sFZT");
pub const STORE: SingleItem<CanonicalAddr, AdminNs> = SingleItem::new();

crate::namespace!(pub PendingAdminNs, b"b5QaJXDibK");
pub const PENDING_ADMIN: SingleItem<CanonicalAddr, PendingAdminNs> = SingleItem::new();

#[interface]
pub trait Admin {
    type Error: std::fmt::Display;

    #[execute]
    fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error>;

    #[query]
    fn admin() -> Result<Option<Addr>, Self::Error>;
}

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum Mode {
    /// The new admin is set using a single transaction where the current admin
    /// calls [`Admin::change_admin`] with this variant and the new admin is set
    /// immediately provided that the transaction succeeded.
    /// 
    /// Use this when the new admin is a contract and it cannot accept the role.
    Immediate { new_admin: String },
    /// The new admin is set using a two-step process. First, the current admin
    /// initiates the change by nominating a new admin by calling [`Admin::change_admin`]
    /// with this variant. Then the nominated address must accept the admin role by
    /// calling [`Admin::change_admin`] but this time with [`None`] as an argument.
    /// It is possible for the current admin to set the pending admin as many times
    /// as needed. This allows to correct any mistakes in case the wrong address was
    /// nominated.
    /// 
    /// Use this when the new admin is always a wallet address and not a contract.
    TwoStep { new_admin: String }
}

/// Initializes the admin module. Sets the messages sender as the admin
/// if `address` is [`None`]. You **must** call this in your instantiate message.
/// 
/// Returns the canonical address of the admin that was set.
pub fn init(
    deps: DepsMut,
    address: Option<&str>,
    info: &MessageInfo
) -> StdResult<CanonicalAddr> {
    let admin = if let Some(addr) = address {
        &addr
    } else {
        info.sender.as_str()
    };

    let admin = admin.canonize(deps.api)?;
    STORE.save(deps.storage, &admin)?;

    Ok(admin)
}

/// Asserts that the message sender is the admin. Otherwise returns an `Err`.
pub fn assert(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admin = STORE.load_humanize(deps)?;

    if let Some(admin) = admin {
        if admin == info.sender {
            return Ok(());
        }
    }

    Err(StdError::generic_err("Unauthorized"))
}

#[derive(Clone, Copy, Debug)]
pub struct DefaultImpl;

impl Admin for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn change_admin(mode: Option<Mode>) -> StdResult<Response> {
        if let Some(mode) = mode {
            assert(deps.as_ref(), &info)?;

            match mode {
                Mode::Immediate { new_admin } =>
                    STORE.canonize_and_save(deps, new_admin.as_str())?,
                Mode::TwoStep { new_admin } =>
                    PENDING_ADMIN.canonize_and_save(deps, new_admin.as_str())?,
            }
        } else {
            if let Some(pending) = PENDING_ADMIN.load_humanize(deps.as_ref())? {
                if pending == info.sender {
                    STORE.canonize_and_save(deps, pending.as_str())?;
                } else {
                    return Err(StdError::generic_err("Unauthorized"));
                }
            } else {
                return Err(StdError::generic_err("No address is currently expected to accept the admin role."));
            }
        }

        Ok(Response::new())
    }

    #[query]
    fn admin() -> StdResult<Option<Addr>> {
        STORE.load_humanize(deps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        admin,
        cosmwasm_std::{
            StdError,
            testing::{mock_dependencies, mock_env, mock_info},
        }
    };

    #[test]
    fn test_init_admin() {
        let ref mut deps = mock_dependencies();

        let admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert!(admin.is_none());

        let admin = "admin";
        admin::init(deps.as_mut(), Some(admin), &mock_info("Tio Macaco", &[])).unwrap();

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);
    }

    #[test]
    fn test_init_default_admin() {
        let ref mut deps = mock_dependencies();

        let admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert!(admin.is_none());

        let admin = "admin";
        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);
    }

    #[test]
    fn test_change_invariants_prior_to_change() {
        let ref mut deps = mock_dependencies();

        let admin = "admin";
        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let new_admin = "new_admin";

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info("What about me?", &[]),
            Some(Mode::Immediate { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info("What about me?", &[]),
            Some(Mode::TwoStep { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info("What about me?", &[]),
            None
        ).unwrap_err();
        assert_no_pending(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            None
        ).unwrap_err();
        assert_no_pending(&err);

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);
    }

    #[test]
    fn test_change_admin_immediate() {
        let ref mut deps = mock_dependencies();

        let admin = "admin";
        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let new_admin = "new_admin";

        DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::Immediate { new_admin: new_admin.into() })
        ).unwrap();

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::Immediate { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::TwoStep { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            None
        ).unwrap_err();
        assert_no_pending(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin, &[]),
            None
        ).unwrap_err();
        assert_no_pending(&err);

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), new_admin);
    }

    #[test]
    fn test_change_admin_two_step() {
        let ref mut deps = mock_dependencies();

        let admin = "admin";
        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let new_admin = "new_admin";
        let new_admin2 = "new_admin2";

        DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::TwoStep { new_admin: new_admin.into() })
        ).unwrap();

        // It should be possible for the admin to set a pending address
        // at any time before the new admin has accepted.
        DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::TwoStep { new_admin: new_admin2.into() })
        ).unwrap();

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin, &[]),
            None
        ).unwrap_err();
        assert_unauthorized(&err);

        DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin2, &[]),
            None
        ).unwrap();

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), new_admin2);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::TwoStep { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        let err = DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            Some(Mode::Immediate { new_admin: new_admin.into() })
        ).unwrap_err();
        assert_unauthorized(&err);

        DefaultImpl::change_admin(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin2, &[]),
            Some(Mode::Immediate { new_admin: new_admin.into() })
        ).unwrap();

        let stored_admin = DefaultImpl::admin(deps.as_ref(), mock_env()).unwrap();
        assert_eq!(stored_admin.unwrap(), new_admin);
    }

    fn assert_unauthorized(err: &StdError) {
        match err {
            StdError::GenericErr { msg } => assert_eq!(msg, "Unauthorized"),
            _ => panic!("Expected \"StdError::GenericErr\"")
        };
    }

    fn assert_no_pending(err: &StdError) {
        match err {
            StdError::GenericErr { msg } => assert_eq!(msg, "No address is currently expected to accept the admin role."),
            _ => panic!("Expected \"StdError::GenericErr\"")
        };
    }
}

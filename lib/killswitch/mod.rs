//! Emergency pause and termination of contracts. You **MUST** implement
//! [admin] in your contract if you want to use this module. This is enforced when using Fadroma DSL.
//! See the [examples](https://github.com/hackbg/fadroma/tree/master/examples) on how to implement it.

use std::fmt;

use crate::{
    self as fadroma,
    admin::{self, Admin, Mode},
    cosmwasm_std,
    dsl::*,
    prelude::*,
};

use serde::{Deserialize, Serialize};

crate::namespace!(pub KillswitchNs, b"zK5CBApPlV");
pub const STORE: SingleItem<ContractStatus<CanonicalAddr>, KillswitchNs> = SingleItem::new();

/// Possible states of a contract.
#[derive(Serialize, Deserialize, Canonize, FadromaSerialize, FadromaDeserialize, JsonSchema, PartialEq, Debug, Clone)]
pub enum ContractStatus<A: Address> {
    /// Live
    Operational,
    /// Temporarily disabled
    Paused {
        reason: String
    },
    /// Permanently disabled
    Migrating {
        reason: String,
        new_address: Option<A>
    }
}

/// Requires the admin component in order to check for admin.
#[interface]
pub trait Killswitch: Admin {
    type Error: std::fmt::Display;

    #[execute]
    fn set_status(
        status: ContractStatus<Addr>
    ) -> Result<Response, <Self as Killswitch>::Error>;

    #[query]
    fn status() -> Result<ContractStatus<Addr>, <Self as Killswitch>::Error>;
}

pub struct DefaultImpl;

impl Admin for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn change_admin(mode: Option<Mode>) -> Result<Response, Self::Error> {
        admin::DefaultImpl::change_admin(deps, env, info, mode)
    }

    #[query]
    fn admin() -> Result<Option<Addr>, Self::Error> {
        admin::DefaultImpl::admin(deps, env)
    }
}

impl Killswitch for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn set_status(
        status: ContractStatus<Addr>
    ) -> StdResult<Response> {
        let msg = status.to_string();
        set_status(deps, info, status)?;

        Ok(Response::new()
            .add_attribute("action", "set_status")
            .add_attribute("status", msg)
        )
    }

    #[query]
    fn status() -> StdResult<ContractStatus<Addr>> {
        STORE.load_humanize_or_default(deps)
    }
}

/// Returns `false` if the current contract status level is other than [`ContractStatus::Operational`].
#[inline]
pub fn is_operational(deps: Deps) -> StdResult<bool> {
    match assert_is_operational(deps) {
        Ok(_) => Ok(true),
        Err(err) if matches!(err, StdError::GenericErr { .. }) => Ok(false),
        Err(err) => Err(err)
    }
}

/// Fail if the current contract status level is other than [`ContractStatus::Operational`].
#[inline]
pub fn assert_is_operational(deps: Deps) -> StdResult<()> {
    let status = STORE.load_or_default(deps.storage)?;

    if !matches!(status, ContractStatus::Operational) {
        let msg = status.humanize(deps.api)?.to_string();

        return Err(StdError::generic_err(msg));
    }

    Ok(())
}

/// Fail if trying to return from [`ContractStatus::Migrating`] status.
#[inline]
pub fn assert_can_set_status(deps: Deps, new: &ContractStatus<Addr>) -> StdResult<()> {
    let current = STORE.load_or_default(deps.storage)?;

    if let ContractStatus::Migrating { .. } = &current {
        // If already migrating, allow the message and new_address to be updated.
        if !matches!(new, ContractStatus::Migrating { .. }) {
            let msg = current.humanize(deps.api)?.to_string();

            return Err(StdError::generic_err(msg));
        }
    }

    Ok(())
}

/// Store a new contract status. Requires the admin component in order to check for admin.
#[inline]
#[admin::require_admin]
pub fn set_status(
    deps: DepsMut,
    info: MessageInfo,
    status: ContractStatus<Addr>
) -> StdResult<()> {
    assert_can_set_status(deps.as_ref(), &status)?;

    STORE.canonize_and_save(deps, status)
}

impl<A: Address> Default for ContractStatus<A> {
    fn default() -> Self {
        Self::Operational
    }
}

impl fmt::Display for ContractStatus<Addr> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ContractStatus::Operational => f.write_str("Operational"),
            ContractStatus::Paused { reason } => write!(f, "Paused\nReason: {}", reason),
            ContractStatus::Migrating { reason, new_address } => if let Some(address) = new_address {
                write!(f, "Migrating to {}\nReason: {}", address, reason)
            } else {
                write!(f, "Migrating\nReason: {}", reason)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cosmwasm_std::testing::{mock_dependencies, mock_info};

    #[test]
    fn test_migrate() {
        let mut deps = mock_dependencies();
        let admin = "admin";

        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert!(matches!(current, ContractStatus::Operational));
        assert_eq!(current, ContractStatus::default());

        let reason = String::from("Reason");
        let new_address = Some(Addr::unchecked("new_address"));

        let paused = ContractStatus::Paused {
            reason: reason.clone()
        };

        let migrating = ContractStatus::Migrating {
            reason: reason.clone(),
            new_address: new_address.clone()
        };

        assert_can_set_status(deps.as_ref(), &ContractStatus::Operational).unwrap();
        assert_can_set_status(deps.as_ref(), &paused).unwrap();
        assert_can_set_status(deps.as_ref(), &migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap();
        assert!(is_operational(deps.as_ref()).unwrap());

        let err = set_status(
            deps.as_mut(),
            mock_info("not_admin", &[]),
            paused.clone()
        ).unwrap_err();

        assert_eq!(err, StdError::generic_err("Unauthorized"));

        set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            paused.clone()
        ).unwrap();

        assert_can_set_status(deps.as_ref(), &ContractStatus::Operational).unwrap();
        assert_can_set_status(deps.as_ref(), &paused).unwrap();
        assert_can_set_status(deps.as_ref(), &migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap_err();
        assert!(!is_operational(deps.as_ref()).unwrap());

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(
            current,
            ContractStatus:: Paused {
                reason: reason.clone()
            }
        );

        let migrating_without_addr = ContractStatus::Migrating {
            reason: reason.clone(),
            new_address: None
        };

        set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            migrating_without_addr.clone()
        ).unwrap();

        assert_can_set_status(deps.as_ref(), &ContractStatus::Operational).unwrap_err();
        assert_can_set_status(deps.as_ref(), &paused).unwrap_err();
        assert_can_set_status(deps.as_ref(), &migrating).unwrap();
        assert_is_operational(deps.as_ref()).unwrap_err();
        assert!(!is_operational(deps.as_ref()).unwrap());

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(current, migrating_without_addr);

        let err = set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            paused.clone()
        ).unwrap_err();

        assert_eq!(err, StdError::generic_err(migrating_without_addr.to_string()));

        let err = set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            ContractStatus::Operational
        ).unwrap_err();

        assert_eq!(err, StdError::generic_err(migrating_without_addr.to_string()));

        set_status(
            deps.as_mut(),
            mock_info(admin, &[]),
            migrating.clone()
        ).unwrap();

        let current = STORE.load_humanize_or_default(deps.as_ref()).unwrap();
        assert_eq!(current, migrating);
    }
}

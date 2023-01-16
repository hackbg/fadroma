//! Admin functionality where a new admin is set using a two-step process. First the current admin
//! initiates the change by nominating a new admin. Then the nominated address must accept the admin role.
//! Use this when the admin is always a wallet address and not a contract.

use crate::{
    cosmwasm_std::{
        self, StdResult, Response, Addr,
        CanonicalAddr, Deps, DepsMut, StdError
    },
    schemars,
    derive_contract::*
};

const PENDING_ADMIN_KEY: &[u8] = b"b5QaJXDibK";

#[contract]
pub trait TwoStepAdmin {
    #[execute]
    fn change_admin(address: String) -> StdResult<Response> {
        super::assert(deps.as_ref(), &info)?;
        save_pending_admin(deps, &address)?;

        Ok(Response::new().add_attribute("pending_admin", address))
    }

    #[execute]
    fn accept_admin() -> StdResult<Response> {
        let pending = load_pending_admin(deps.as_ref())?;

        if let Some(pending_admin) = pending {
            if pending_admin != info.sender {
                return Err(StdError::generic_err("Unauthorized"));
            }

            super::save(deps.branch(), pending_admin.as_str())?;
        } else {
            return Err(StdError::generic_err("New admin is not set."));
        }

        deps.storage.remove(PENDING_ADMIN_KEY);

        Ok(Response::new().add_attribute("new_admin", info.sender))
    }

    #[query]
    fn admin() -> StdResult<Option<Addr>> {
        super::load(deps)
    }
}

/// Loads the currently pending admin from storage if there is such. 
pub fn load_pending_admin(deps: Deps) -> StdResult<Option<Addr>> {
    let result = deps.storage.get(PENDING_ADMIN_KEY);

    match result {
        Some(bytes) => {
            let admin = CanonicalAddr::from(bytes);

            Ok(Some(deps.api.addr_humanize(&admin)?))
        }
        None => Ok(None),
    }
}

/// Saves the new admin address that needs to accept the role to storage.
pub fn save_pending_admin(deps: DepsMut, address: &str) -> StdResult<()> {
    let address = deps.api.addr_canonicalize(address)?;
    deps.storage.set(PENDING_ADMIN_KEY, address.as_slice());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        admin,
        cosmwasm_std::{
            Storage, from_binary,
            testing::{mock_dependencies, mock_env, mock_info},
        }
    };

    #[test]
    fn test_admin() {
        let mut deps = mock_dependencies();

        let admin = "admin";
        admin::init(deps.as_mut(), Some(admin), &mock_info("sender", &[])).unwrap();

        let msg = ExecuteMsg::ChangeAdmin {
            address: String::from("will fail"),
        };

        let result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info("unauthorized", &[]),
            msg,
            DefaultImpl,
        )
        .unwrap_err();

        match result {
            StdError::GenericErr { msg } => {
                assert_eq!(msg, "Unauthorized")
            }
            _ => panic!("Expected \"StdError::Unauthorized\""),
        };

        let new_admin = Addr::unchecked("new_admin");

        let result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin.as_str(), &[]),
            ExecuteMsg::AcceptAdmin {},
            DefaultImpl,
        )
        .unwrap_err();

        match result {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "New admin is not set.")
            }
            _ => panic!("Expected \"StdError::GenericErr\""),
        };

        let msg = ExecuteMsg::ChangeAdmin {
            address: new_admin.clone().into(),
        };

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            msg,
            DefaultImpl,
        )
        .unwrap();

        assert_eq!(
            load_pending_admin(deps.as_ref()).unwrap().unwrap(),
            new_admin
        );

        let result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info("unauthorized", &[]),
            ExecuteMsg::AcceptAdmin {},
            DefaultImpl,
        )
        .unwrap_err();

        match result {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "Unauthorized")
            }
            _ => panic!("Expected \"StdError::GenericErr\""),
        };

        let result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            ExecuteMsg::AcceptAdmin {},
            DefaultImpl,
        )
        .unwrap_err();

        match result {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "Unauthorized")
            }
            _ => panic!("Expected \"StdError::GenericErr\""),
        };

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let stored_admin: Option<Addr> = from_binary(&result).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin.as_str(), &[]),
            ExecuteMsg::AcceptAdmin {},
            DefaultImpl,
        )
        .unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let stored_admin: Option<Addr> = from_binary(&result).unwrap();
        assert_eq!(stored_admin.unwrap(), new_admin);
        
        assert!(deps.storage.get(PENDING_ADMIN_KEY).is_none())
    }

    #[test]
    fn test_init_default_admin() {
        let ref mut deps = mock_dependencies();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let admin: Option<Addr> = from_binary(&result).unwrap();
        assert!(admin.is_none());

        let admin = "admin";
        admin::init(deps.as_mut(), None, &mock_info(admin, &[])).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let stored_admin: Option<Addr> = from_binary(&result).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);
    }
}

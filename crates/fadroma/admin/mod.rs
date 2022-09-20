//! *Feature flag: `admin`*
//! Transaction authentication by pre-configured admin address.

use crate::derive_contract::*;
use crate::prelude::*;

pub use fadroma_proc_auth::*;

const ADMIN_KEY: &[u8] = b"ltp5P6sFZT";
const PENDING_ADMIN_KEY: &[u8] = b"b5QaJXDibK";

#[contract]
pub trait Admin {
    #[init]
    fn new(admin: Option<String>) -> StdResult<Response> {
        let admin = if let Some(addr) = admin {
            deps.api.addr_canonicalize(&addr)?
        } else {
            deps.api.addr_canonicalize(info.sender.as_str())?
        };

        save_admin(deps.storage, &admin);

        Ok(Response::default())
    }

    #[handle]
    fn change_admin(address: String) -> StdResult<Response> {
        assert_admin(deps.as_ref(), &info)?;

        let canonized_address = deps.api.addr_canonicalize(&address)?;
        save_pending_admin(deps.storage, &canonized_address);

        Ok(Response::new().add_attribute("pending_admin", address))
    }

    #[handle]
    fn accept_admin() -> StdResult<Response> {
        let pending = load_pending_admin(deps.as_ref())?;

        if let Some(pending_admin) = pending {
            if pending_admin != info.sender {
                return Err(StdError::generic_err("Unauthorized"));
            }

            save_admin(
                deps.storage,
                &deps.api.addr_canonicalize(pending_admin.as_str())?,
            );
        } else {
            return Err(StdError::generic_err("New admin is not set."));
        }

        deps.storage.remove(PENDING_ADMIN_KEY);

        Ok(Response::new().add_attribute("new_admin", info.sender))
    }

    #[query]
    fn admin() -> StdResult<Option<Addr>> {
        load_admin(deps)
    }
}

pub fn load_admin(deps: Deps) -> StdResult<Option<Addr>> {
    let result = deps.storage.get(ADMIN_KEY);

    match result {
        Some(bytes) => {
            let admin = CanonicalAddr::from(bytes);

            Ok(Some(deps.api.addr_humanize(&admin)?))
        }
        None => Ok(None),
    }
}

pub fn save_admin(storage: &mut dyn Storage, address: &CanonicalAddr) {
    storage.set(ADMIN_KEY, address.as_slice())
}

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

pub fn save_pending_admin(storage: &mut dyn Storage, address: &CanonicalAddr) {
    storage.set(PENDING_ADMIN_KEY, address.as_slice());
}

pub fn assert_admin(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admin = load_admin(deps)?;

    if let Some(addr) = admin {
        if addr == info.sender {
            return Ok(());
        }
    }

    Err(StdError::generic_err("Unauthorized"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma_platform_scrt::cosmwasm_std::{
        from_binary,
        testing::{mock_dependencies, mock_env, mock_info},
        Storage,
    };

    #[test]
    fn test_handle() {
        let mut deps = mock_dependencies();

        let admin = "admin";
        let admin_canon = deps.api.addr_canonicalize(admin).unwrap();
        save_admin(deps.as_mut().storage, &admin_canon);

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

        assert_eq!(
            load_admin(deps.as_ref()).unwrap().unwrap(),
            Addr::unchecked(admin)
        );

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(new_admin.as_str(), &[]),
            ExecuteMsg::AcceptAdmin {},
            DefaultImpl,
        )
        .unwrap();

        assert_eq!(load_admin(deps.as_ref()).unwrap().unwrap(), new_admin);
        assert!(deps.storage.get(PENDING_ADMIN_KEY).is_none())
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();

        let address: Option<Addr> = from_binary(&result).unwrap();
        assert!(address.is_none());

        let admin = Addr::unchecked("admin");
        let admin_canon = deps.api.addr_canonicalize(admin.as_str()).unwrap();
        save_admin(deps.as_mut().storage, &admin_canon);

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let address: Addr = from_binary(&result).unwrap();
        assert!(address == admin);
    }
}

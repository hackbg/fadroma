//! *Feature flag: `admin`*
//! Transaction authentication by pre-configured admin address.

use crate::prelude::*;
use crate::derive_contract::*;

pub use fadroma_proc_auth::*;

const ADMIN_KEY: &[u8] = b"ltp5P6sFZT";
const PENDING_ADMIN_KEY: &[u8] = b"b5QaJXDibK";

#[contract]
pub trait Admin {
    #[init]
    fn new(admin: Option<Addr>) -> StdResult<InitResponse> {
        let admin = if let Some(addr) = admin {
            addr
        } else {
            env.message.sender
        };

        save_admin(deps, &admin)?;

        Ok(InitResponse::default())
    }

    #[handle]
    fn change_admin(address: Addr) -> StdResult<HandleResponse> {
        assert_admin(deps, &env)?;
        save_pending_admin(deps, &address)?;
    
        Ok(HandleResponse {
            messages: vec![],
            log: vec![log("pending_admin", address)],
            data: None
        })
    }

    #[handle]
    fn accept_admin() -> StdResult<HandleResponse> {
        let pending = load_pending_admin(deps)?;

        if pending != env.message.sender {
            return Err(StdError::unauthorized())
        }

        save_admin(deps, &pending)?;
        deps.storage.remove(PENDING_ADMIN_KEY);

        Ok(HandleResponse {
            messages: vec![],
            log: vec![log("new_admin", env.message.sender)],
            data: None
        })
    }

    #[query]
    fn admin() -> StdResult<Addr> {
        let address = load_admin(deps)?;

        Ok(address)
    }
}

pub fn load_admin<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>
) -> StdResult<Addr> {
    let result = deps.storage.get(ADMIN_KEY);

    match result {
        Some(bytes) => {
            let admin = CanonicalAddr::unchecked(bytes);

            deps.api.human_address(&admin)
        },
        None => {
            Ok(Addr::default())
        }
    }
}

pub fn save_admin<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    address: &Addr
) -> StdResult<()> {
    let admin = deps.api.canonical_address(address)?;
    deps.storage.set(ADMIN_KEY, &admin.as_slice());

    Ok(())
}


pub fn load_pending_admin<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>
) -> StdResult<Addr> {
    let result = deps.storage.get(PENDING_ADMIN_KEY);

    match result {
        Some(bytes) => {
            let admin = CanonicalAddr::unchecked(bytes);

            deps.api.human_address(&admin)
        },
        None => {
            Err(StdError::generic_err("New admin not set."))
        }
    }
}

pub fn save_pending_admin<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    address: &Addr
) -> StdResult<()> {
    let admin = deps.api.canonical_address(address)?;
    deps.storage.set(PENDING_ADMIN_KEY, &admin.as_slice());

    Ok(())
}

pub fn assert_admin<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    env: &Env
) -> StdResult<()> {
    let admin = load_admin(deps)?;

    if admin == env.message.sender {
        return Ok(());
    }

    Err(StdError::unauthorized())
}

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma_platform_scrt::cosmwasm_std::{
        Storage, from_binary,
        testing::{mock_dependencies, mock_env}
    };

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(10, &[]);

        let admin = "admin";
        save_admin(deps, &Addr::unchecked(admin)).unwrap();

        let msg = HandleMsg::ChangeAdmin { 
            address: Addr::unchecked("will fail")
        };

        let result = handle(
            deps,
            mock_env("unauthorized", &[]),
            msg,
            DefaultImpl
        ).unwrap_err();
        
        match result {
            StdError::Unauthorized { .. } => { },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        let new_admin = Addr::unchecked("new_admin");

        let result = handle(
            deps,
            mock_env(new_admin.clone(), &[]),
            HandleMsg::AcceptAdmin {},
            DefaultImpl
        ).unwrap_err();

        match result {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "New admin not set.")
            },
            _ => panic!("Expected \"StdError::GenericErr\"")
        };

        let msg = HandleMsg::ChangeAdmin { 
            address: new_admin.clone()
        };

        handle(
            deps,
            mock_env(admin, &[]),
            msg,
            DefaultImpl
        ).unwrap();

        assert_eq!(load_pending_admin(deps).unwrap(), new_admin);

        let result = handle(
            deps,
            mock_env("unauthorized", &[]),
            HandleMsg::AcceptAdmin {},
            DefaultImpl
        ).unwrap_err();

        match result {
            StdError::Unauthorized { .. } => { },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        let result = handle(
            deps,
            mock_env(admin, &[]),
            HandleMsg::AcceptAdmin {},
            DefaultImpl
        ).unwrap_err();

        match result {
            StdError::Unauthorized { .. } => { },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        assert_eq!(load_admin(deps).unwrap(), Addr::unchecked(admin));

        handle(
            deps,
            mock_env(new_admin.clone(), &[]),
            HandleMsg::AcceptAdmin {},
            DefaultImpl
        ).unwrap();

        assert_eq!(load_admin(deps).unwrap(), new_admin);
        assert!(deps.storage.get(PENDING_ADMIN_KEY).is_none())
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(10, &[]);

        let result = query(deps, QueryMsg::Admin {}, DefaultImpl).unwrap();

        let address: Addr = from_binary(&result).unwrap();
        assert!(address == Addr::default());

        let admin = Addr::unchecked("admin");
        save_admin(deps, &admin).unwrap();

        let result = query(deps, QueryMsg::Admin {}, DefaultImpl).unwrap();
        let address: Addr = from_binary(&result).unwrap();
        assert!(address == admin);
    }
}

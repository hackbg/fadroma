use crate::{
    scrt::{
        Addr, StdResult, Response, MessageInfo,
        Deps, DepsMut, StdError, CanonicalAddr
    },
    derive_contract::{contract, init, handle, query}
};
use schemars;
use serde;

const ADMIN_KEY: &[u8] = b"ltp5P6sFZT";

#[contract]
pub trait Admin {
    #[init]
    fn new(admin: Option<String>) -> StdResult<Response> {
        let admin = if let Some(addr) = admin {
            deps.api.addr_validate(addr.as_str())?
        } else {
            info.sender
        };

        save_admin(deps, &admin)?;

        Ok(Response::default())
    }

    #[handle]
    fn change_admin(address: String) -> StdResult<Response> {
        assert_admin(deps.as_ref(), &info)?;

        let address = deps.api.addr_validate(address.as_str())?;
        save_admin(deps, &address)?;
    
        Ok(Response::default())
    }

    #[query("address")]
    fn admin() -> StdResult<Addr> {
        let address = load_admin(deps)?;

        Ok(address)
    }
}

pub fn load_admin(deps: Deps) -> StdResult<Addr> {
    let result = deps.storage.get(ADMIN_KEY);

    if let Some(bytes) = result {
        let admin = CanonicalAddr::from(bytes);

        deps.api.addr_humanize(&admin)
    } else {
        Ok(Addr::unchecked(""))
    }
}

pub fn save_admin(deps: DepsMut, address: &Addr) -> StdResult<()> {
    let admin = deps.api.addr_canonicalize(address.as_str())?;
    deps.storage.set(ADMIN_KEY, &admin.as_slice());

    Ok(())
}

pub fn assert_admin(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admin = load_admin(deps)?;

    if admin == info.sender {
        return Ok(());
    }

    Err(StdError::generic_err("Unauthorized"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scrt::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(&[]);

        let admin = Addr::unchecked("admin");
        save_admin(deps.as_mut(), &admin).unwrap();

        let msg = HandleMsg::ChangeAdmin { 
            address: String::from("will fail")
        };

        let result = handle(
            deps.as_mut(),
            mock_env(),
            mock_info("unauthorized", &[]),
            msg,
            DefaultImpl
        ).unwrap_err();
        
        match result {
            StdError::GenericErr { msg } => {
                assert_eq!(msg, "Unauthorized")
            },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        let new_admin = Addr::unchecked("new_admin");

        let msg = HandleMsg::ChangeAdmin { 
            address: new_admin.to_string()
        };

        handle(
            deps.as_mut(),
            mock_env(),
            mock_info(admin.as_str(), &[]),
            msg,
            DefaultImpl
        ).unwrap();

        assert!(load_admin(deps.as_ref()).unwrap() == new_admin);
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(&[]);

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();

        match result {
            QueryResponse::Admin { address } => {
                assert!(address == Addr::unchecked(""));
            }
        }

        let admin = Addr::unchecked("admin");
        save_admin(deps.as_mut(), &admin).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();

        match result {
            QueryResponse::Admin { address } => {
                assert!(address == admin);
            }
        }
    }
}

use crate::{
    scrt::{
        Addr, StdResult, Response, MessageInfo,
        Deps, Storage, StdError, CanonicalAddr
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

        let address = deps.api.addr_canonicalize(&address)?;
        save_admin(deps.storage, &address);
    
        Ok(Response::default())
    }

    #[query("address")]
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
        },
        None => Ok(None)
    }
}

pub fn save_admin(storage: &mut dyn Storage, address: &CanonicalAddr) {
    storage.set(ADMIN_KEY, address.as_slice())
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
    use crate::scrt::{mock_dependencies, mock_env, mock_info};

    const ADMIN: &str = "admin";

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(&[]);

        init(
            deps.as_mut(),
            mock_env(),
            mock_info(ADMIN, &[]),
            InitMsg {
                admin: None
            },
            DefaultImpl
        ).unwrap();

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
            mock_info(ADMIN, &[]),
            msg,
            DefaultImpl
        ).unwrap();

        assert!(load_admin(deps.as_ref()).unwrap().unwrap() == new_admin);
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(&[]);

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();

        match result {
            QueryResponse::Admin { address } => {
                assert!(address == None);
            }
        }

        let custom_admin = "custom_admin";

        init(
            deps.as_mut(),
            mock_env(),
            mock_info(ADMIN, &[]),
            InitMsg {
                admin: Some(custom_admin.into())
            },
            DefaultImpl
        ).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();

        match result {
            QueryResponse::Admin { address } => {
                assert!(address.unwrap() == custom_admin);
            }
        }
    }
}

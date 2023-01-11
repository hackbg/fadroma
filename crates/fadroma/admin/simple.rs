//! Admin functionality where a new admin can be set by sending a single message by the current admin.
//! Use this when the admin can be another contract.

use crate::{
    cosmwasm_std::{self, StdResult, Response, Addr},
    schemars,
    derive_contract::*
};
use super::{init_admin, save_admin, load_admin, assert_admin};

#[contract]
pub trait SimpleAdmin {
    #[init]
    fn new(admin: Option<String>) -> StdResult<Response> {
        init_admin(deps, admin.as_ref(), &info)?;

        Ok(Response::default())
    }

    #[execute]
    fn change_admin(address: String) -> StdResult<Response> {
        assert_admin(deps.as_ref(), &info)?;
        save_admin(deps, &address)?;

        Ok(Response::new().add_attribute("new_admin", address))
    }

    #[query]
    fn admin() -> StdResult<Option<Addr>> {
        load_admin(deps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cosmwasm_std::{
        StdError, from_binary,
        testing::{mock_dependencies, mock_env, mock_info},
    };

    #[test]
    fn test_admin() {
        let mut deps = mock_dependencies();

        let admin = "admin";
        instantiate(
            deps.as_mut(),
            mock_env(),
            mock_info("sender", &[]),
            InstantiateMsg { admin: Some(admin.into()) },
            DefaultImpl
        ).unwrap();

        let msg = ExecuteMsg::ChangeAdmin { 
            address: "will fail".into()
        };

        let result = execute(
            deps.as_mut(),
            mock_env(),
            mock_info("unauthorized", &[]),
            msg,
            DefaultImpl
        ).unwrap_err();
        
        match result {
            StdError::GenericErr { .. } => { },
            _ => panic!("Expected \"StdError::GenericErr\"")
        };

        let new_admin = "new_admin";

        let msg = ExecuteMsg::ChangeAdmin { 
            address: new_admin.into()
        };

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            msg,
            DefaultImpl
        ).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let stored_admin: Option<Addr> = from_binary(&result).unwrap();
        assert_eq!(stored_admin.unwrap(), new_admin);
    }

    #[test]
    fn test_init_default_admin() {
        let ref mut deps = mock_dependencies();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let admin: Option<Addr> = from_binary(&result).unwrap();
        assert!(admin.is_none());

        let admin = "admin";
        instantiate(
            deps.as_mut(),
            mock_env(),
            mock_info(admin, &[]),
            InstantiateMsg { admin: None },
            DefaultImpl
        ).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admin {}, DefaultImpl).unwrap();
        let stored_admin: Option<Addr> = from_binary(&result).unwrap();
        assert_eq!(stored_admin.unwrap(), admin);
    }
}

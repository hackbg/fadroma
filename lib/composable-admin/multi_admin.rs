use crate::{
    scrt::{
        Addr, StdResult, Response, MessageInfo,
        Deps, StdError, CanonicalAddr, Storage
    },
    derive_contract::{contract, init, handle, query},
    scrt_addr::Canonize,
    scrt_storage::{load, save}
};

use schemars;
use serde;

const ADMINS_KEY: &[u8] = b"i801onL3kf";

#[contract]
pub trait MultiAdmin {
    #[init]
    fn new(admins: Option<Vec<String>>) -> StdResult<Response> {
        let admins = if let Some(addresses) = admins {
            addresses.canonize(deps.api)?
        } else {
            let sender = deps.api.addr_canonicalize(info.sender.as_str())?;

            vec![ sender ]
        };

        add_admins(deps.storage, admins)?;

        Ok(Response::default())
    }

    #[handle]
    fn add_admins(addresses: Vec<String>) -> StdResult<Response> {
        assert_admin(deps.as_ref(), &info)?;

        let addresses = addresses.canonize(deps.api)?;
        add_admins(deps.storage, addresses)?;
    
        Ok(Response::default())
    }

    #[query("addresses")]
    fn admins() -> StdResult<Vec<Addr>> {
        load_admins(deps)
    }
}

pub fn add_admins(storage: &mut dyn Storage, addresses: Vec<CanonicalAddr>) -> StdResult<()> {
    let mut admins: Vec<CanonicalAddr> = 
        load(storage, ADMINS_KEY)?.unwrap_or(vec![]);

    admins.extend(addresses);

    save(storage, ADMINS_KEY, &admins)
}

pub fn load_admins(deps: Deps) -> StdResult<Vec<Addr>> {
    let admins: Vec<CanonicalAddr> =
        load(deps.storage, ADMINS_KEY)?.unwrap_or(vec![]);
    
    let mut result = Vec::with_capacity(admins.len());

    for admin in admins {
        result.push(deps.api.addr_humanize(&admin)?)
    }

    Ok(result)
}

pub fn assert_admin(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    let admins = load_admins(deps)?;

    if admins.contains(&info.sender) {
        return Ok(());
    }

    Err(StdError::generic_err("Unauthorized"))
}

#[cfg(test)]
mod tests {
    use cosmwasm_std::Api;

    use super::*;
    use crate::scrt::{mock_dependencies, mock_env, mock_info, DepsMut};

    #[test]
    fn test_handle() {
        const ADMIN: &str = "goshu";

        fn run_msg(
            mut deps: DepsMut,
            addresses: Vec<String>,
            assert_len: usize
        ) {
            let msg = HandleMsg::AddAdmins {
                addresses
            };
    
            let result = handle(
                deps.branch(),
                mock_env(),
                mock_info(ADMIN, &[]),
                msg,
                DefaultImpl
            );
    
            assert!(result.is_ok());
    
            let admins = load_admins(deps.as_ref()).unwrap();
            assert!(
                admins.len() == assert_len,
                "Assert admins.len() failed: Expected: {}, Got: {}", admins.len(), assert_len
            );
        }

        let ref mut deps = mock_dependencies(&[]);

        let admin = deps.api.addr_canonicalize(ADMIN).unwrap();
        add_admins(deps.as_mut().storage, vec![ admin ]).unwrap();

        let msg = HandleMsg::AddAdmins {
            addresses: vec![ String::from("will fail") ]
        };

        let result = handle(
            deps.as_mut(),
            mock_env(),
            mock_info("unauthorized", &[]),
            msg,
            DefaultImpl
        )
        .unwrap_err();

        match result {
            StdError::GenericErr { msg } => {
                assert_eq!(msg, "Unauthorized")
            },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        run_msg(deps.as_mut(), vec![], 1);

        run_msg(
            deps.as_mut(),
            vec![
                "archer".into(),
                "lana".into()
            ],
            3
        );

        run_msg(
            deps.as_mut(),
            vec![
                "pam".into(),
            ],
            4
        );
    }

    #[test]
    fn test_query() {
        let mut deps = mock_dependencies(&[]);

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admins {}, DefaultImpl).unwrap();
        
        match result {
            QueryResponse::Admins { addresses } => {
                assert!(addresses.len() == 0);
            }
        }

        let admins = vec![
            Addr::unchecked("archer"),
            Addr::unchecked("lana")
        ];

        let admins_cannon = admins.canonize(deps.as_ref().api).unwrap();

        add_admins(deps.as_mut().storage, admins_cannon).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admins {}, DefaultImpl).unwrap();
        match result {
            QueryResponse::Admins { addresses } => {
                assert!(addresses == admins);
            }
        }
    }
}

use crate::{
    scrt::{
        Addr, StdResult, Response, Api, MessageInfo,
        DepsMut, Deps, StdError, CanonicalAddr
    },
    scrt_storage::*,
    derive_contract::{contract, init, handle, query}
};
use schemars;
use serde;

const ADMINS_KEY: &[u8] = b"i801onL3kf";

#[contract]
pub trait MultiAdmin {
    #[init]
    fn new(admins: Option<Vec<String>>) -> StdResult<Response> {
        let admins: Vec<Addr> = if let Some(addresses) = admins {
            validate_addresses(addresses, deps.api)?
        } else {
            vec![ info.sender ]
        };

        save_admins(deps, &admins)?;

        Ok(Response::default())
    }

    #[handle]
    fn add_admins(addresses: Vec<String>) -> StdResult<Response> {
        assert_admin(deps.as_ref(), &info)?;

        let addresses = validate_addresses(addresses, deps.api)?;
        save_admins(deps, &addresses)?;
    
        Ok(Response::default())
    }

    #[query("addresses")]
    fn admins() -> StdResult<Vec<Addr>> {
        let addresses = load_admins(deps)?;

        Ok(addresses)
    }
}

pub fn save_admins(deps: DepsMut, addresses: &Vec<Addr>) -> StdResult<()> {
    let mut admins: Vec<CanonicalAddr> = 
        load(deps.storage, ADMINS_KEY)?.unwrap_or(vec![]);
    
    for address in addresses {
        let canonical = deps.api.addr_canonicalize(address.as_str())?;
        admins.push(canonical);
    }

    save(deps.storage, ADMINS_KEY, &admins)
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

pub fn validate_addresses(addresses: Vec<String>, api: &dyn Api) -> StdResult<Vec<Addr>> {
    addresses
        .iter()
        .map(|x| api.addr_validate(x))
        .collect::<StdResult<Vec<Addr>>>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scrt::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_handle() {
        const ADMIN: &str = "goshu";

        fn run_msg(
            deps: &mut DepsMut,
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

        let admin = Addr::unchecked("goshu");
        save_admins(deps.as_mut(), &vec![ admin.clone() ]).unwrap();

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

        run_msg(&mut deps.as_mut(), vec![], 1);

        run_msg(
            &mut deps.as_mut(),
            vec![
                "archer".into(),
                "lana".into()
            ],
            3
        );

        run_msg(
            &mut deps.as_mut(),
            vec![
                "pam".into(),
            ],
            4
        );
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(&[]);

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

        save_admins(deps.as_mut(), &admins).unwrap();

        let result = query(deps.as_ref(), mock_env(), QueryMsg::Admins {}, DefaultImpl).unwrap();
        match result {
            QueryResponse::Admins { addresses } => {
                assert!(addresses == admins);
            }
        }
    }
}

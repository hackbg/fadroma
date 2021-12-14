use crate::{
    scrt::{
        HumanAddr, StdResult, InitResponse, HandleResponse,
        Extern, Env, Querier, Storage, Api, StdError, CanonicalAddr
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
    fn new(admins: Option<Vec<HumanAddr>>) -> StdResult<InitResponse> {
        let admins = if let Some(addresses) = admins {
            addresses
        } else {
            vec![ env.message.sender ]
        };

        save_admins(deps, &admins)?;

        Ok(InitResponse::default())
    }

    #[handle]
    fn add_admins(addresses: Vec<HumanAddr>) -> StdResult<HandleResponse> {
        assert_admin(deps, &env)?;
        save_admins(deps, &addresses)?;
    
        Ok(HandleResponse::default())
    }

    #[query("addresses")]
    fn admins() -> StdResult<Vec<HumanAddr>> {
        let addresses = load_admins(deps)?;

        Ok(addresses)
    }
}

pub fn save_admins<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    addresses: &Vec<HumanAddr>
) -> StdResult<()> {
    let mut admins: Vec<CanonicalAddr> = 
        load(&deps.storage, ADMINS_KEY)?.unwrap_or(vec![]);
    
    for address in addresses {
        let canonical = deps.api.canonical_address(address)?;
        admins.push(canonical);
    }

    save(&mut deps.storage, ADMINS_KEY, &admins)
}

pub fn load_admins<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>
) -> StdResult<Vec<HumanAddr>> {
    let admins: Vec<CanonicalAddr> =
        load(&deps.storage, ADMINS_KEY)?.unwrap_or(vec![]);
    
    let mut result = Vec::with_capacity(admins.len());

    for admin in admins {
        result.push(deps.api.human_address(&admin)?)
    }

    Ok(result)
}

pub fn assert_admin<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    env: &Env,
) -> StdResult<()> {
    let admins = load_admins(deps)?;

    if admins.contains(&env.message.sender) {
        return Ok(());
    }

    Err(StdError::unauthorized())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scrt::{mock_dependencies, mock_env};

    #[test]
    fn test_handle() {
        const ADMIN: &str = "goshu";

        fn run_msg<S: Storage, A: Api, Q: Querier>(
            deps: &mut Extern<S, A, Q>,
            addresses: Vec<HumanAddr>,
            assert_len: usize
        ) {
            let msg = HandleMsg::AddAdmins {
                addresses
            };
    
            let result = handle(
                deps,
                mock_env(HumanAddr::from(ADMIN), &[]),
                msg,
                DefaultImpl
            );
    
            assert!(result.is_ok());
    
            let admins = load_admins(deps).unwrap();
            assert!(
                admins.len() == assert_len,
                "Assert admins.len() failed: Expected: {}, Got: {}", admins.len(), assert_len
            );
        }

        let ref mut deps = mock_dependencies(10, &[]);

        let admin = HumanAddr::from("goshu");
        save_admins(deps, &vec![ admin.clone() ]).unwrap();

        let msg = HandleMsg::AddAdmins {
            addresses: vec![ HumanAddr::from("will fail") ]
        };

        let result = handle(
            deps,
            mock_env(HumanAddr::from("unauthorized"), &[]),
            msg,
            DefaultImpl
        )
        .unwrap_err();

        match result {
            StdError::Unauthorized { .. } => { },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        run_msg(deps, vec![], 1);

        run_msg(
            deps,
            vec![
                HumanAddr::from("archer"),
                HumanAddr::from("lana")
            ],
            3
        );

        run_msg(
            deps,
            vec![
                HumanAddr::from("pam"),
            ],
            4
        );
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(10, &[]);

        let result = query(deps, QueryMsg::Admins {}, DefaultImpl).unwrap();
        
        match result {
            QueryResponse::Admins { addresses } => {
                assert!(addresses.len() == 0);
            }
        }

        let admins = vec![
            HumanAddr::from("archer"),
            HumanAddr::from("lana")
        ];

        save_admins(deps, &admins).unwrap();

        let result = query(deps, QueryMsg::Admins {}, DefaultImpl).unwrap();
        match result {
            QueryResponse::Admins { addresses } => {
                assert!(addresses == admins);
            }
        }
    }
}

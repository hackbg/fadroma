use cosmwasm_std::{
    HumanAddr, CanonicalAddr, StdResult, Extern, Env,
    Api, Querier, Storage, StdError, HandleResponse,
    Binary, to_binary
};
use schemars::JsonSchema;
use serde::{Serialize, Deserialize};
use fadroma_scrt_storage::{save, load};

const ADMINS_KEY: &[u8] = b"i801onL3kf";

pub fn multi_admin_handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: MultiAdminHandleMsg,
    handle: impl MultiAdminHandle,
) -> StdResult<HandleResponse> {
    match msg {
        MultiAdminHandleMsg::AddAdmins { addresses } => handle.add_admins(deps, env, addresses)
    }
}

pub fn multi_admin_query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: MultiAdminQueryMsg,
    query: impl MultiAdminQuery,
) -> StdResult<Binary> {
    match msg {
        MultiAdminQueryMsg::Admins => query.query_admins(deps)
    }
}

pub trait MultiAdminHandle {
    fn add_admins<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        addresses: Vec<HumanAddr>,
    ) -> StdResult<HandleResponse> {
        assert_admin(deps, &env)?;
        save_admins(deps, &addresses)?;
    
        Ok(HandleResponse::default())
    }
}

pub trait MultiAdminQuery {
    fn query_admins<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>
    )-> StdResult<Binary> {
        let addresses = load_admins(deps)?;
    
        to_binary(&MultiAdminQueryResponse { 
            addresses
        })
    }
}

pub struct DefaultHandleImpl;

impl MultiAdminHandle for DefaultHandleImpl { }

pub struct DefaultQueryImpl;

impl MultiAdminQuery for DefaultQueryImpl { }

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MultiAdminHandleMsg {
    AddAdmins {
        addresses: Vec<HumanAddr>,
    }
}

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MultiAdminQueryMsg {
    Admins
}

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct MultiAdminQueryResponse {
    pub addresses: Vec<HumanAddr>
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
    use cosmwasm_std::from_binary;
    use cosmwasm_std::testing::{mock_dependencies, mock_env};

    #[test]
    fn test_handle() {
        const ADMIN: &str = "goshu";

        fn run_msg<S: Storage, A: Api, Q: Querier>(
            deps: &mut Extern<S, A, Q>,
            addresses: Vec<HumanAddr>,
            assert_len: usize
        ) {
            let msg = MultiAdminHandleMsg::AddAdmins {
                addresses
            };
    
            let result = multi_admin_handle(
                deps,
                mock_env(HumanAddr::from(ADMIN), &[]),
                msg,
                DefaultHandleImpl
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

        let msg = MultiAdminHandleMsg::AddAdmins {
            addresses: vec![ HumanAddr::from("will fail") ]
        };

        let result = multi_admin_handle(
            deps,
            mock_env(HumanAddr::from("unauthorized"), &[]),
            msg,
            DefaultHandleImpl
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

        let result = multi_admin_query(deps, MultiAdminQueryMsg::Admins, DefaultQueryImpl).unwrap();

        let response: MultiAdminQueryResponse = from_binary(&result).unwrap();
        assert!(response.addresses.len() == 0);

        let admins = vec![
            HumanAddr::from("archer"),
            HumanAddr::from("lana")
        ];

        save_admins(deps, &admins).unwrap();

        let result = multi_admin_query(deps, MultiAdminQueryMsg::Admins, DefaultQueryImpl).unwrap();

        let response: MultiAdminQueryResponse = from_binary(&result).unwrap();
        assert!(response.addresses == admins);
    }
}

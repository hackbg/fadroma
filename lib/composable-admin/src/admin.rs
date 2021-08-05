use fadroma::*;
use schemars::JsonSchema;
use serde::{Serialize, Deserialize};

const ADMIN_KEY: &[u8] = b"ltp5P6sFZT";

pub fn admin_handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: AdminHandleMsg,
    handle: impl AdminHandle,
) -> StdResult<HandleResponse> {
    match msg {
        AdminHandleMsg::ChangeAdmin { address } => handle.change_admin(deps, env, address)
    }
}

pub fn admin_query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: AdminQueryMsg,
    query: impl AdminQuery,
) -> StdResult<Binary> {
    match msg {
        AdminQueryMsg::Admin => query.query_admin(deps)
    }
}

pub trait AdminHandle {
    fn change_admin<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &mut Extern<S, A, Q>,
        env: Env,
        address: HumanAddr,
    ) -> StdResult<HandleResponse> {
        assert_admin(deps, &env)?;
        save_admin(deps, &address)?;
    
        Ok(HandleResponse::default())
    }
}

pub trait AdminQuery {
    fn query_admin<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>
    )-> StdResult<Binary> {
        let address = load_admin(deps)?;
    
        to_binary(&AdminQueryResponse { 
            address
        })
    }
}

pub struct DefaultHandleImpl;

impl AdminHandle for DefaultHandleImpl { }

pub struct DefaultQueryImpl;

impl AdminQuery for DefaultQueryImpl { }

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AdminHandleMsg {
    ChangeAdmin {
        address: HumanAddr
    }
}

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AdminQueryMsg {
    Admin
}

#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AdminQueryResponse {
    pub address: HumanAddr
}

pub fn load_admin<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>
) -> StdResult<HumanAddr> {
    let result = deps.storage.get(ADMIN_KEY);

    if let Some(bytes) = result {
        let admin = CanonicalAddr::from(bytes);

        deps.api.human_address(&admin)
    } else {
        Ok(HumanAddr::default())
    }
}

pub fn save_admin<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    address: &HumanAddr
) -> StdResult<()> {
    let admin = deps.api.canonical_address(address)?;
    deps.storage.set(ADMIN_KEY, &admin.as_slice());

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
    use fadroma::testing::*;

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(10, &[]);

        let admin = HumanAddr::from("admin");
        save_admin(deps, &admin).unwrap();

        let msg = AdminHandleMsg::ChangeAdmin { 
            address: HumanAddr::from("will fail")
        };

        let result = admin_handle(
            deps,
            mock_env("unauthorized", &[]),
            msg,
            DefaultHandleImpl
        ).unwrap_err();
        
        match result {
            StdError::Unauthorized { .. } => { },
            _ => panic!("Expected \"StdError::Unauthorized\"")
        };

        let new_admin = HumanAddr::from("new_admin");

        let msg = AdminHandleMsg::ChangeAdmin { 
            address: new_admin.clone()
        };

        admin_handle(
            deps,
            mock_env(admin, &[]),
            msg,
            DefaultHandleImpl
        ).unwrap();

        assert!(load_admin(deps).unwrap() == new_admin);
    }

    #[test]
    fn test_query() {
        let ref mut deps = mock_dependencies(10, &[]);

        let result = admin_query(deps, AdminQueryMsg::Admin, DefaultQueryImpl).unwrap();

        let response: AdminQueryResponse = from_binary(&result).unwrap();
        assert!(response.address == HumanAddr::default());

        let admin = HumanAddr::from("admin");
        save_admin(deps, &admin).unwrap();

        let result = admin_query(deps, AdminQueryMsg::Admin, DefaultQueryImpl).unwrap();

        let response: AdminQueryResponse = from_binary(&result).unwrap();
        assert!(response.address == admin);
    }
}

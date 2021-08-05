// The example contract from https://github.com/enigmampc/secret-template
// implemented with fadroma and composable-admin

use fadroma::*;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use composable_admin::require_admin;
use composable_admin::admin::{
    AdminQueryMsg, AdminHandleMsg, AdminQuery,
    save_admin, admin_handle, admin_query, DefaultHandleImpl, 
    assert_admin // used in "require_admin" macro
};

// We could simply not include "AdminQueryMsg" on line 53
// but doing it like this for demonstration purposes
pub struct CustomQueryImpl;

impl AdminQuery for CustomQueryImpl {
    fn query_admin<S: Storage, A: Api, Q: Querier>(
        &self,
        _deps: &Extern<S, A, Q>
    )-> StdResult<Binary> {
        Err(StdError::generic_err("Admin address is undisclosed."))
    }
}

// MESSAGE

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InitMsg {
    pub count: i32,
    pub admin: Option<HumanAddr>
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HandleMsg {
    Increment {},
    Reset { count: i32 },
    Admin(AdminHandleMsg)
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetCount {},
    Admin(AdminQueryMsg)
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct CountResponse {
    pub count: i32,
}

// STATE

pub const STATE_KEY: &[u8] = b"config";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema, Default)]
pub struct State {
    pub count: i32
}

fn save_state(storage: &mut impl Storage, state: &State) -> StdResult<()> {
    save(storage, STATE_KEY, state)
}

fn load_state(storage: &impl Storage) -> StdResult<State> {
    Ok(load(storage, STATE_KEY)?.unwrap_or_default())
}

// CONTRACT

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    let state = State {
        count: msg.count
    };

    save_state(&mut deps.storage, &state)?;

    let admin = msg.admin.unwrap_or(env.message.sender.clone());
    save_admin(deps, &admin)?;

    debug_print!("Contract was initialized by {}", env.message.sender);

    Ok(InitResponse::default())
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> StdResult<HandleResponse> {
    match msg {
        HandleMsg::Increment {} => try_increment(deps, env),
        HandleMsg::Reset { count } => try_reset(deps, env, count),
        HandleMsg::Admin(admin_msg) => admin_handle(deps, env, admin_msg, DefaultHandleImpl)
    }
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetCount {} => query_count(deps),
        QueryMsg::Admin(admin_msg) => admin_query(deps, admin_msg, CustomQueryImpl)
    }
}

fn try_increment<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    _env: Env,
) -> StdResult<HandleResponse> {
    let mut state = load_state(&deps.storage)?;
    state.count += 1;

    save_state(&mut deps.storage, &state)?;

    debug_print!("count = {}", state.count);
    debug_print("count incremented successfully");

    Ok(HandleResponse::default())
}

#[require_admin]
fn try_reset<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    count: i32,
) -> StdResult<HandleResponse> {
    let mut state = load_state(&deps.storage)?;
    state.count = count;

    save_state(&mut deps.storage, &state)?;

    debug_print("count reset successfully");

    Ok(HandleResponse::default())
}

fn query_count<S: Storage, A: Api, Q: Querier>(deps: &Extern<S, A, Q>) -> StdResult<Binary> {
    let state = load_state(&deps.storage)?;

    Ok(to_binary(&CountResponse { 
        count: state.count 
    })?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env};
    use cosmwasm_std::{coins, from_binary, StdError};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies(20, &[]);

        let msg = InitMsg { count: 17, admin: None };
        let env = mock_env("creator", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = init(&mut deps, env, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(&deps, QueryMsg::GetCount {}).unwrap();
        let value: CountResponse = from_binary(&res).unwrap();
        assert_eq!(17, value.count);
    }

    #[test]
    fn increment() {
        let mut deps = mock_dependencies(20, &coins(2, "token"));

        let msg = InitMsg { count: 17, admin: None };
        let env = mock_env("creator", &coins(2, "token"));
        init(&mut deps, env, msg).unwrap();

        // anyone can increment
        let env = mock_env("anyone", &coins(2, "token"));
        let msg = HandleMsg::Increment {};
        handle(&mut deps, env, msg).unwrap();

        // should increase counter by 1
        let res = query(&deps, QueryMsg::GetCount {}).unwrap();
        let value: CountResponse = from_binary(&res).unwrap();
        assert_eq!(18, value.count);
    }

    #[test]
    fn query_admin_undisclosed() {
        let ref mut deps = mock_dependencies(20, &[]);
        let env = mock_env("creator", &[]);

        let msg = InitMsg { count: 17, admin: None };
        init(deps, env, msg).unwrap();

        let result = query(deps, QueryMsg::Admin(AdminQueryMsg::Admin)).unwrap_err();

        match result {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "Admin address is undisclosed.");
            },
            _ => panic!("Expected StdError::GenericErr")
        }
    }

    #[test]
    fn reset() {
        let mut deps = mock_dependencies(20, &coins(2, "token"));

        let msg = InitMsg { count: 17, admin: None };
        let env = mock_env("creator", &coins(2, "token"));

        init(&mut deps, env, msg).unwrap();

        // not anyone can reset
        let unauth_env = mock_env("anyone", &coins(2, "token"));
        let msg = HandleMsg::Reset { count: 5 };
        let res = handle(&mut deps, unauth_env, msg);
        match res {
            Err(StdError::Unauthorized { .. }) => {}
            _ => panic!("Must return unauthorized error"),
        }

        // only the original creator can reset the counter
        let auth_env = mock_env("creator", &coins(2, "token"));
        let msg = HandleMsg::Reset { count: 5 };
        let _res = handle(&mut deps, auth_env, msg).unwrap();

        // should now be 5
        let res = query(&deps, QueryMsg::GetCount {}).unwrap();
        let value: CountResponse = from_binary(&res).unwrap();
        assert_eq!(5, value.count);
    }
}

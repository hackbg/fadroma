use fadroma::prelude::*;

/// Initial configuration of the register.
#[message] pub struct InitMsg {
    /// Optionally, the initial value of the register
    value: Option<String>
}

/// Changing the value of the register.
#[message] pub enum HandleMsg {
    /// Set the value of the register
    Set(String),
    /// Empty the register
    Del
}

/// Reading the value of the register.
#[message] pub enum QueryMsg {
    /// Get the value of the register
    Get
}

const KEY: &'static [u8] = b"value";

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>, _env: Env, msg: InitMsg,
) -> StdResult<InitResponse> {
    if let Some(value) = msg.value {
        save(&mut deps.storage, KEY, &value)?;
    }
    Ok(InitResponse::default())
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>, _env: Env, msg: HandleMsg,
) -> StdResult<HandleResponse> {
    match msg {
        HandleMsg::Set(value) => save(&mut deps.storage, KEY, &value)?,
        HandleMsg::Del        => remove(&mut deps.storage, KEY)
    };
    Ok(HandleResponse::default())
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>, msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Get => if let Some(value) = load::<String, S>(&deps.storage, KEY)? {
            to_binary(&value)
        } else {
            Err(StdError::generic_err("empty"))
        }
    }
}

fadroma::entrypoint!(fadroma, init, handle, query);

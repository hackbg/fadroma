use fadroma::{
    prelude::message,
    schemars,
    cosmwasm_std::{
        Deps, DepsMut, StdResult, Env, StdError,
        MessageInfo, Response, Binary, to_binary
    },
    storage::{load, save, remove}
};

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

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InitMsg
) -> StdResult<Response> {
    if let Some(value) = msg.value {
        save(deps.storage, KEY, &value)?;
    }

    Ok(Response::default())
}

pub fn execute(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: HandleMsg
) -> StdResult<Response> {
    match msg {
        HandleMsg::Set(value) => save(deps.storage, KEY, &value)?,
        HandleMsg::Del => remove(deps.storage, KEY)
    };
    Ok(Response::default())
}

pub fn query(
    deps: Deps,
    _env: Env,
    msg: QueryMsg
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Get => if let Some(value) = load::<String>(deps.storage, KEY)? {
            to_binary(&value)
        } else {
            Err(StdError::generic_err("empty"))
        }
    }
}

fadroma::entrypoint!(fadroma, instantiate, execute, query);

use crate::{
    scrt::{StdError, DepsMut, Deps, Response, to_binary},
    scrt_storage::*,
    scrt_vk::*,
    derive_contract::{contract, handle}
};
use schemars::JsonSchema;
use serde::{Serialize, Deserialize};

const VIEWING_KEYS: &[u8] = b"XXzo7ZXRJ2";

#[contract]
pub trait Auth {
    #[handle]
    fn create_viewing_key(entropy: String, _padding: Option<String>) -> StdResult<Response> {
        let prng_seed = [ 
            env.block.time.seconds().to_be_bytes(),
            env.block.height.to_be_bytes() 
        ].concat();

        let key = ViewingKey::new(&env, &info, &prng_seed, &(entropy).as_ref());
        let address = deps.api.addr_canonicalize(&info.sender.as_str())?;
        save_viewing_key(deps, address.as_slice(), &key)?;

        Ok(Response::new()
            .set_data(to_binary(&AuthHandleAnswer::CreateViewingKey { key })?)
        )
    }

    #[handle]
    fn set_viewing_key(key: String, _padding: Option<String>) -> StdResult<Response> {
        let key = ViewingKey(key);
        let address = deps.api.addr_canonicalize(&info.sender.as_str())?;
        save_viewing_key(deps, address.as_slice(), &key)?;

        Ok(Response::default())
    }
}

// Enum with one variant because Keplr expects this format.
#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthHandleAnswer {
    CreateViewingKey {
        key: ViewingKey,
    }
}

#[inline]
pub fn save_viewing_key(
    deps: DepsMut,
    key: &[u8],
    viewing_key: &ViewingKey
) -> StdResult<()> {
    ns_save(deps.storage, VIEWING_KEYS, key, &viewing_key)
}

#[inline]
pub fn load_viewing_key(
    deps: Deps,
    key: &[u8],
) -> StdResult<Option<ViewingKey>> {
    ns_load(deps.storage, VIEWING_KEYS, key)
}

pub fn authenticate(
    storage: &dyn Storage,
    provided_key: &ViewingKey,
    storage_key: &[u8]
) -> StdResult<()> {
    let stored_vk: Option<ViewingKey> = ns_load(storage, VIEWING_KEYS, storage_key)?;

    if let Some(key) = stored_vk {
        if provided_key.check_viewing_key(&key.to_hashed()) {
            return Ok(());
        }
    }

    provided_key.check_viewing_key(&[0u8; VIEWING_KEY_SIZE]);

    return Err(StdError::generic_err("Unauthorized"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{Api, from_binary};
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(&[]);

        let sender = "sender";
        let sender_canonical = deps.api.addr_canonicalize(&sender).unwrap();
        let env = mock_env();

        let result = handle(
            deps.as_mut(),
            env.clone(),
            mock_info(sender, &[]),
            HandleMsg::CreateViewingKey { entropy: "123".into(), padding: None },
            DefaultImpl
        ).unwrap();

        let result: AuthHandleAnswer = from_binary(&result.data.unwrap()).unwrap();
        let created_vk = match result {
            AuthHandleAnswer::CreateViewingKey { key } => {
                key
            }
        };
        
        assert_eq!(created_vk, load_viewing_key(deps.as_ref(), sender_canonical.as_slice()).unwrap().unwrap());

        let auth_result = authenticate(&deps.storage, &ViewingKey("invalid".into()), sender_canonical.as_slice());
        assert_eq!(auth_result.unwrap_err(), StdError::generic_err("Unauthorized"));

        let auth_result = authenticate(&deps.storage, &created_vk, sender_canonical.as_slice());
        assert!(auth_result.is_ok());

        let new_key = String::from("new_key");

        handle(
            deps.as_mut(),
            env,
            mock_info(sender, &[]),
            HandleMsg::SetViewingKey { key: new_key.clone(), padding: None },
            DefaultImpl
        ).unwrap();

        assert_eq!(ViewingKey(new_key.clone()), load_viewing_key(deps.as_ref(), sender_canonical.as_slice()).unwrap().unwrap());

        let auth_result = authenticate(&deps.storage, &ViewingKey(new_key), sender_canonical.as_slice());
        assert!(auth_result.is_ok());
    }
}

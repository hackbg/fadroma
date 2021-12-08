use crate::vk::*;
use fadroma_scrt::*;
use fadroma_storage::*;
use schemars::JsonSchema;
use serde::{Serialize, Deserialize};

const VIEWING_KEYS: &[u8] = b"XXzo7ZXRJ2";

#[contract]
pub trait Auth {
    #[handle]
    fn create_viewing_key(entropy: String, _padding: Option<String>) -> StdResult<HandleResponse> {
        let prng_seed = [ 
            env.block.time.to_be_bytes(),
            env.block.height.to_be_bytes() 
        ].concat();

        let key = ViewingKey::new(&env, &prng_seed, &(entropy).as_ref());
        let address = deps.api.canonical_address(&env.message.sender)?;
        save_viewing_key(deps, address.as_slice(), &key)?;

        Ok(HandleResponse {
            messages: vec![],
            log: vec![],
            data: Some(to_binary(&AuthHandleAnswer::CreateViewingKey {
                key
            })?)
        })
    }

    #[handle]
    fn set_viewing_key(key: String, _padding: Option<String>) -> StdResult<HandleResponse> {
        let key = ViewingKey(key);
        let address = deps.api.canonical_address(&env.message.sender)?;
        save_viewing_key(deps, address.as_slice(), &key)?;

        Ok(HandleResponse::default())
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
pub fn save_viewing_key<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    key: &[u8],
    viewing_key: &ViewingKey
) -> StdResult<()> {
    ns_save(&mut deps.storage, VIEWING_KEYS, key, &viewing_key)
}

#[inline]
pub fn load_viewing_key<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    key: &[u8],
) -> StdResult<Option<ViewingKey>> {
    ns_load(&deps.storage, VIEWING_KEYS, key)
}

pub fn authenticate(
    storage: &impl Storage,
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

    return Err(StdError::unauthorized());
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{from_binary, HumanAddr};
    use cosmwasm_std::testing::{mock_dependencies, mock_env};

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies(10, &[]);

        let sender = HumanAddr("sender".into());
        let sender_canonical = deps.api.canonical_address(&sender).unwrap();
        let env = mock_env(sender, &[]);

        let result = handle(
            deps,
            env.clone(),
            HandleMsg::CreateViewingKey { entropy: "123".into(), padding: None },
            DefaultImpl
        ).unwrap();

        let result: AuthHandleAnswer = from_binary(&result.data.unwrap()).unwrap();
        let created_vk = match result {
            AuthHandleAnswer::CreateViewingKey { key } => {
                key
            }
        };
        
        assert_eq!(created_vk, load_viewing_key(deps, sender_canonical.as_slice()).unwrap().unwrap());

        let auth_result = authenticate(&deps.storage, &ViewingKey("invalid".into()), sender_canonical.as_slice());
        assert_eq!(auth_result.unwrap_err(), StdError::unauthorized());

        let auth_result = authenticate(&deps.storage, &created_vk, sender_canonical.as_slice());
        assert!(auth_result.is_ok());

        let new_key = String::from("new_key");

        handle(
            deps,
            env.clone(),
            HandleMsg::SetViewingKey { key: new_key.clone(), padding: None },
            DefaultImpl
        ).unwrap();

        assert_eq!(ViewingKey(new_key.clone()), load_viewing_key(deps, sender_canonical.as_slice()).unwrap().unwrap());

        let auth_result = authenticate(&deps.storage, &ViewingKey(new_key), sender_canonical.as_slice());
        assert!(auth_result.is_ok());
    }
}

//! Customizable functionality for implementing
//! viewing keys in your smart contract.

use super::{ViewingKey, ViewingKeyHashed};
use crate::derive_contract::*;
use crate::prelude::*;
use serde::{Deserialize, Serialize};

const VIEWING_KEYS: &[u8] = b"XXzo7ZXRJ2";

#[contract]
pub trait VkAuth {
    #[execute]
    fn create_viewing_key(entropy: String, _padding: Option<String>) -> StdResult<Response> {
        let prng_seed = [
            env.block.time.seconds().to_be_bytes(),
            env.block.height.to_be_bytes(),
        ]
        .concat();

        let key = ViewingKey::new(&env, &info, &prng_seed, entropy.as_bytes());
        let address = deps.api.addr_canonicalize(&info.sender.as_str())?;
        save_viewing_key(deps.storage, address.as_slice(), &key)?;

        Ok(Response::new().set_data(
            to_binary(&AuthExecuteAnswer::CreateViewingKey { key })?
        ))
    }

    #[execute]
    fn set_viewing_key(key: String, _padding: Option<String>) -> StdResult<Response> {
        let key = ViewingKey(key);
        let address = deps.api.addr_canonicalize(&info.sender.as_str())?;
        save_viewing_key(deps.storage, address.as_slice(), &key)?;

        Ok(Response::new().set_data(
            to_binary(
                &AuthExecuteAnswer::SetViewingKey {
                    status: AuthResponseStatus::Success
                }
            )?
        ))
    }
}

// SNIP-20 compliance
#[derive(JsonSchema, Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AuthExecuteAnswer {
    CreateViewingKey { key: ViewingKey },
    SetViewingKey { status: AuthResponseStatus },
}

// SNIP-20 compliance
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum AuthResponseStatus {
    Success,
    Failure,
}

/// Saves the `viewing_key` under the given storage `key` which should
/// be **unique**. This would usualy be the [`CanonicalAddr`] bytes.
/// The `key` is concatenated with random bytes before storing to prevent
/// storage collisions.
#[inline]
pub fn save_viewing_key(
    storage: &mut dyn Storage,
    key: &[u8],
    viewing_key: &ViewingKey
) -> StdResult<()> {
    ns_save(storage, VIEWING_KEYS, key, &viewing_key.to_hashed())
}

/// Loads the stored viewing key if any using the given storage `key`
/// which should be **unique**. This would usualy be the [`CanonicalAddr`] bytes.
#[inline]
pub fn load_viewing_key(
    storage: &dyn Storage,
    key: &[u8]
) -> StdResult<Option<ViewingKeyHashed>> {
    ns_load(storage, VIEWING_KEYS, key)
}

pub fn authenticate(
    storage: &impl Storage,
    provided_key: &ViewingKey,
    storage_key: &[u8],
) -> StdResult<()> {
    let stored_vk = load_viewing_key(storage, storage_key)?;

    if let Some(key) = stored_vk {
        if provided_key.check_hashed(&key) {
            return Ok(());
        }
    }

    ViewingKeyHashed::default().check(&ViewingKeyHashed::default());

    return Err(StdError::generic_err("Unauthorized"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::from_binary;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies();

        let sender = "sender";
        let sender_canonical = deps.api.addr_canonicalize(&sender).unwrap();
        let env = mock_env();

        let result = execute(
            deps.as_mut(),
            env.clone(),
            mock_info(sender, &[]),
            ExecuteMsg::CreateViewingKey {
                entropy: "123".into(),
                padding: None,
            },
            DefaultImpl,
        )
        .unwrap();

        let result: AuthExecuteAnswer = from_binary(&result.data.unwrap()).unwrap();
        let created_vk = match result {
            AuthExecuteAnswer::CreateViewingKey { key } => key,
            _ => panic!("Expecting AuthHandleAnswer::CreateViewingKey"),
        };


        let stored_vk = load_viewing_key(deps.as_ref().storage, sender_canonical.as_slice()).unwrap().unwrap();
        assert!(created_vk.check_hashed(&stored_vk));

        let auth_result = authenticate(
            &deps.storage,
            &ViewingKey("invalid".into()),
            sender_canonical.as_slice(),
        );
        assert_eq!(
            auth_result.unwrap_err(),
            StdError::generic_err("Unauthorized")
        );

        let auth_result = authenticate(&deps.storage, &created_vk, sender_canonical.as_slice());
        assert!(auth_result.is_ok());

        let new_key = String::from("new_key");

        execute(
            deps.as_mut(),
            env.clone(),
            mock_info(sender, &[]),
            ExecuteMsg::SetViewingKey {
                key: new_key.clone(),
                padding: None,
            },
            DefaultImpl,
        )
        .unwrap();

        let new_key = ViewingKey(new_key);
        let stored_vk = load_viewing_key(deps.as_ref().storage, sender_canonical.as_slice()).unwrap().unwrap();
        assert!(new_key.check_hashed(&stored_vk));

        let auth_result = authenticate(
            &deps.storage,
            &new_key,
            sender_canonical.as_slice(),
        );
        assert!(auth_result.is_ok());
    }
}

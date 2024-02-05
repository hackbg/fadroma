//! Customizable functionality for implementing viewing keys in your smart contract.
//! See the [examples](https://github.com/hackbg/fadroma/tree/master/examples) on how to implement it.

use serde::{Deserialize, Serialize};

use crate::{
    dsl::*,
    core::Canonize,
    storage::{ItemSpace, TypedKey},
    cosmwasm_std::{
        self, StdResult, StdError, Storage,
        Response, CanonicalAddr, to_binary
    },
    schemars::JsonSchema
};
use super::{ViewingKey, ViewingKeyHashed};

crate::namespace!(pub ViewingKeysNs, b"XXzo7ZXRJ2");
pub const STORE: ItemSpace<
    ViewingKeyHashed,
    ViewingKeysNs,
    TypedKey<CanonicalAddr>
> = ItemSpace::new();

#[interface]
pub trait VkAuth {
    type Error: std::fmt::Display;

    #[execute]
    fn create_viewing_key(entropy: String, _padding: Option<String>) -> Result<Response, Self::Error>;

    #[execute]
    fn set_viewing_key(key: String, _padding: Option<String>) -> Result<Response, Self::Error>;
}

pub struct DefaultImpl;

impl VkAuth for DefaultImpl {
    type Error = StdError;

    #[execute]
    fn create_viewing_key(entropy: String, _padding: Option<String>) -> StdResult<Response> {
        let prng_seed = [
            env.block.time.seconds().to_be_bytes(),
            env.block.height.to_be_bytes(),
        ]
        .concat();

        let key = ViewingKey::new(&env, &info, &prng_seed, entropy.as_bytes());
        STORE.save(
            deps.storage,
            &info.sender.canonize(deps.api)?,
            &key.to_hashed()
        )?;

        Ok(Response::new().set_data(
            to_binary(&AuthExecuteAnswer::CreateViewingKey { key })?
        ))
    }

    #[execute]
    fn set_viewing_key(key: String, _padding: Option<String>) -> StdResult<Response> {
        let key = ViewingKey(key);
        STORE.save(
            deps.storage,
            &info.sender.canonize(deps.api)?,
            &key.to_hashed()
        )?;

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

pub fn authenticate(
    storage: &dyn Storage,
    provided_key: &ViewingKey,
    addr: &CanonicalAddr,
) -> StdResult<()> {
    let stored_vk = STORE.load(storage, addr)?;

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
    use cosmwasm_std::{Api, from_binary};
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};

    #[test]
    fn test_handle() {
        let ref mut deps = mock_dependencies();

        let sender = "sender";
        let sender_canonical = deps.api.addr_canonicalize(&sender).unwrap();
        let env = mock_env();

        let result = DefaultImpl::create_viewing_key(
            deps.as_mut(),
            env.clone(),
            mock_info(sender, &[]),
            "123".into(),
            None
        ).unwrap();

        let result: AuthExecuteAnswer = from_binary(&result.data.unwrap()).unwrap();
        let created_vk = match result {
            AuthExecuteAnswer::CreateViewingKey { key } => key,
            _ => panic!("Expecting AuthHandleAnswer::CreateViewingKey"),
        };

        let stored_vk = STORE.load(deps.as_ref().storage, &sender_canonical).unwrap().unwrap();
        assert!(created_vk.check_hashed(&stored_vk));

        let auth_result = authenticate(
            &deps.storage,
            &ViewingKey("invalid".into()),
            &sender_canonical
        );
        assert_eq!(
            auth_result.unwrap_err(),
            StdError::generic_err("Unauthorized")
        );

        let auth_result = authenticate(&deps.storage, &created_vk, &sender_canonical);
        assert!(auth_result.is_ok());

        let new_key = String::from("new_key");

        DefaultImpl::set_viewing_key(
            deps.as_mut(),
            env.clone(),
            mock_info(sender, &[]),
            new_key.clone(),
            None,
        )
        .unwrap();

        let new_key = ViewingKey(new_key);
        let stored_vk = STORE.load(deps.as_ref().storage, &sender_canonical).unwrap().unwrap();
        assert!(new_key.check_hashed(&stored_vk));

        let auth_result = authenticate(
            &deps.storage,
            &new_key,
            &sender_canonical
        );
        assert!(auth_result.is_ok());
    }
}

#![cfg(test)]

use super::*;
use cosmwasm_std::{from_binary, HumanAddr};
use cosmwasm_std::testing::{mock_dependencies, mock_env};

#[test]
fn test_handle() {
    let ref mut deps = mock_dependencies(10, &[]);

    let sender = HumanAddr("sender".into());
    let sender_canonical = deps.api.canonical_address(&sender).unwrap();
    let env = mock_env(sender, &[]);

    let result = auth_handle(
        deps,
        env.clone(),
        AuthHandleMsg::CreateViewingKey { entropy: "123".into(), padding: None },
        DefaultHandleImpl
    ).unwrap();

    let result: HandleAnswer = from_binary(&result.data.unwrap()).unwrap();
    let created_vk = match result {
        HandleAnswer::CreateViewingKey { key } => {
            key
        }
    };
    
    assert_eq!(created_vk, load_viewing_key(deps, sender_canonical.as_slice()).unwrap().unwrap());

    let auth_result = authenticate(&deps.storage, &ViewingKey("invalid".into()), sender_canonical.as_slice());
    assert_eq!(auth_result.unwrap_err(), StdError::unauthorized());

    let auth_result = authenticate(&deps.storage, &created_vk, sender_canonical.as_slice());
    assert!(auth_result.is_ok());

    let new_key = String::from("new_key");

    auth_handle(
        deps,
        env.clone(),
        AuthHandleMsg::SetViewingKey { key: new_key.clone(), padding: None },
        DefaultHandleImpl
    ).unwrap();

    assert_eq!(ViewingKey(new_key.clone()), load_viewing_key(deps, sender_canonical.as_slice()).unwrap().unwrap());

    let auth_result = authenticate(&deps.storage, &ViewingKey(new_key), sender_canonical.as_slice());
    assert!(auth_result.is_ok());
}

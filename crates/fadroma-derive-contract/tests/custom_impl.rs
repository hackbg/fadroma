use cosmwasm_std::{StdResult, InitResponse, HandleResponse, Storage, to_vec, from_slice, from_binary};
use cosmwasm_std::testing::{mock_dependencies, mock_env};
use fadroma_derive_contract::*;
use schemars;
use serde;

pub mod string_component {
    use super::*;

    const KEY_STRING: &[u8] = b"string_data";

    #[contract]
    pub trait StringComponent {
        fn new(storage: &mut impl Storage, string: String) -> StdResult<()> {
            Ok(storage.set(KEY_STRING, &to_vec(&string)?))
        }

        #[handle]
        fn set_string(string: String) -> StdResult<HandleResponse> {
            deps.storage.set(KEY_STRING, &to_vec(&string)?);

            Ok(HandleResponse::default())
        }

        #[query]
        fn get_string(_padding: Option<String>) -> StdResult<String> {
            let value = deps.storage.get(KEY_STRING).unwrap();

            from_slice(&value)
        }
    }
}

use string_component::StringComponent;

pub struct CustomStringImpl;

impl string_component::StringComponent for CustomStringImpl {
    #[query]
    fn get_string(_padding: Option<String>) -> StdResult<String> {
        Ok(String::from("hardcoded"))
    }
}

#[contract(component(path = "string_component", custom_impl = "CustomStringImpl", skip(handle)))]
pub trait CustomImplContract {
    #[init]
    fn new(string: String) -> StdResult<InitResponse> {
        CustomStringImpl::new(&mut deps.storage, string)?;

        Ok(InitResponse::default())
    }
}

#[test]
fn uses_custom_impl() {
    let ref mut deps = mock_dependencies(20, &[]);
    let env = mock_env("sender", &[]);

    let msg = InitMsg {
        string: String::from("test")
    };

    init(deps, env.clone(), msg, DefaultImpl).unwrap();

    let result = query(
        deps,
        QueryMsg::StringComponent(
            string_component::QueryMsg::GetString { padding: None }
        ),
        DefaultImpl
    ).unwrap();

    let string: String = from_binary(&result).unwrap();
    assert_eq!(string, String::from("hardcoded"));
}

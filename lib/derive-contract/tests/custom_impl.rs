use fadroma::scrt::{StdResult, Response, Storage, to_vec, from_slice};
use fadroma::cosmwasm_std;
use fadroma::scrt::testing::{mock_dependencies, mock_env, mock_info};
use derive_contract::*;
use fadroma::schemars;
use serde;

pub mod string_component {
    use super::*;

    const KEY_STRING: &[u8] = b"string_data";

    #[contract]
    pub trait StringComponent {
        fn new(storage: &mut dyn Storage, string: String) -> StdResult<()> {
            Ok(storage.set(KEY_STRING, &to_vec(&string)?))
        }

        #[handle]
        fn set_string(string: String) -> StdResult<Response> {
            deps.storage.set(KEY_STRING, &to_vec(&string)?);

            Ok(Response::default())
        }

        #[query("string")]
        fn get_string(_padding: Option<String>) -> StdResult<String> {
            let value = deps.storage.get(KEY_STRING).unwrap();

            from_slice(&value)
        }
    }
}

use string_component::StringComponent;

pub struct CustomStringImpl;

impl string_component::StringComponent for CustomStringImpl {
    #[query("string")]
    fn get_string(_padding: Option<String>) -> StdResult<String> {
        Ok(String::from("hardcoded"))
    }
}

#[contract(component(path = "string_component", custom_impl = "CustomStringImpl", skip(handle)))]
pub trait CustomImplContract {
    #[init]
    fn new(string: String) -> StdResult<Response> {
        CustomStringImpl::new(deps.storage, string)?;

        Ok(Response::default())
    }
}

#[test]
fn uses_custom_impl() {
    let ref mut deps = mock_dependencies(&[]);

    let msg = InitMsg {
        string: String::from("test")
    };

    init(deps.as_mut(), mock_env(), mock_info("sender", &[]), msg, DefaultImpl).unwrap();

    let result = query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::StringComponent(
            string_component::QueryMsg::GetString { padding: None }
        ),
        DefaultImpl
    ).unwrap();

    match result {
        QueryResponse::StringComponent(string_component::QueryResponse::GetString { string }) => {
            assert_eq!(string, String::from("hardcoded"));
        }
    }
}

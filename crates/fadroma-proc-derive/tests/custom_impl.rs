use fadroma_proc_derive::*;
use cosmwasm_std::{
    StdResult, StdError, Response, Storage, to_vec, from_slice, from_binary,
    testing::{mock_dependencies, mock_env, mock_info}
};
use schemars;
use serde;

pub mod string_component {
    use super::*;

    const KEY_STRING: &[u8] = b"string_data";

    #[contract]
    pub trait StringComponent {
        fn new(storage: &mut dyn Storage, string: String) -> StdResult<()> {
            Ok(storage.set(KEY_STRING, &to_vec(&string)?))
        }

        #[handle_guard]
        fn guard(_msg: &ExecuteMsg) -> StdResult<()> {
            Ok(())
        }

        #[handle]
        fn set_string(string: String) -> StdResult<Response> {
            deps.storage.set(KEY_STRING, &to_vec(&string)?);

            Ok(Response::default())
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

    #[handle_guard]
    fn guard(msg: &string_component::ExecuteMsg) -> StdResult<()> {
        match msg  {
            string_component::ExecuteMsg::SetString { string } => {
                if string.is_empty() {
                    return Err(StdError::generic_err("String cannot be empty."));
                }
            }
        }

        Ok(())
    }
}

mod test_skip {
    use super::*;

    #[contract(component(path = "string_component", custom_impl = "CustomStringImpl", skip(handle)))]
    pub trait CustomImplContractWithSkip {
        #[init]
        fn new(string: String) -> StdResult<Response> {
            CustomStringImpl::new(deps.storage, string)?;

            Ok(Response::default())
        }
    }
}

#[contract(component(path = "string_component", custom_impl = "CustomStringImpl"))]
pub trait CustomImplContract {
    #[init]
    fn new(string: String) -> StdResult<Response> {
        CustomStringImpl::new(deps.storage, string)?;

        Ok(Response::default())
    }
}

#[test]
fn uses_custom_impl() {
    let mut deps = mock_dependencies();
    let env = mock_env();

    let msg = InstantiateMsg {
        string: String::from("test")
    };

    instantiate(deps.as_mut(), env.clone(), mock_info("sender", &[]), msg, DefaultImpl).unwrap();

    let err = execute(
        deps.as_mut(),
        env.clone(),
        mock_info("sender", &[]),
        ExecuteMsg::StringComponent(
            string_component::ExecuteMsg::SetString { string: String::new() }
        ),
        DefaultImpl
    ).unwrap_err();

    assert_eq!(err, StdError::generic_err("String cannot be empty."));

    let result = query(
        deps.as_ref(),
        env,
        QueryMsg::StringComponent(
            string_component::QueryMsg::GetString { padding: None }
        ),
        DefaultImpl
    ).unwrap();

    let string: String = from_binary(&result).unwrap();
    assert_eq!(string, String::from("hardcoded"));
}

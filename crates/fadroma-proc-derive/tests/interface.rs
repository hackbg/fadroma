use cosmwasm_std::{from_slice, to_vec, Response, StdResult, Storage};
use fadroma_proc_derive::*;
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

        #[execute]
        fn set_string(string: String) -> StdResult<Response> {
            deps.storage.set(KEY_STRING, &to_vec(&string)?);

            Ok(Response::default())
        }

        #[query]
        fn get_string() -> StdResult<String> {
            let value = deps.storage.get(KEY_STRING).unwrap();

            from_slice(&value)
        }
    }
}

pub mod number_interface {
    use super::*;

    #[interface(component(path = "string_component"))]
    pub trait NumberInterface {
        #[init]
        fn new(number: u8, string: String) -> StdResult<Response>;

        #[execute]
        fn set_number(number: u8) -> StdResult<Response>;

        #[query]
        fn get_number() -> StdResult<u8>;
    }
}

pub mod number_contract {
    use super::*;
    use string_component::StringComponent;

    const KEY_NUMBER: &[u8] = b"number_data";

    #[contract_impl(path = "number_interface", component(path = "string_component"))]
    pub trait NumberContract {
        #[init]
        fn new(number: u8, string: String) -> StdResult<Response> {
            string_component::DefaultImpl::new(deps.storage, string)?;
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(Response::default())
        }

        #[execute]
        fn set_number(number: u8) -> StdResult<Response> {
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(Response::default())
        }

        #[query]
        fn get_number() -> StdResult<u8> {
            let value = deps.storage.get(KEY_NUMBER).unwrap();

            from_slice(&value)
        }
    }
}

mod tests {
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{from_binary, Deps };

    use super::number_contract::{instantiate, execute, query, DefaultImpl};
    use super::number_interface::{ExecuteMsg, InstantiateMsg, QueryMsg};
    use super::string_component;

    #[test]
    fn contract_functions() {
        let ref mut deps = mock_dependencies();
        let env = mock_env();

        let string = String::from("test");
        let number = 5;

        let msg = InstantiateMsg {
            string: string.clone(),
            number,
        };

        instantiate(
            deps.as_mut(),
            env.clone(),
            mock_info("sender", &[]),
            msg,
            DefaultImpl,
        )
        .unwrap();

        test_queries(deps.as_ref(), number, string);

        let string = String::from("test_2");
        let number = 10;

        execute(
            deps.as_mut(),
            env.clone(),
            mock_info("sender", &[]),
            ExecuteMsg::SetNumber { number },
            DefaultImpl,
        )
        .unwrap();
        execute(
            deps.as_mut(),
            env,
            mock_info("sender", &[]),
            ExecuteMsg::StringComponent(string_component::ExecuteMsg::SetString {
                string: string.clone(),
            }),
            DefaultImpl,
        )
        .unwrap();

        test_queries(deps.as_ref(), number, string);
    }

    fn test_queries(deps: Deps, expected_num: u8, expected_str: String) {
        let result = query(deps, mock_env(), QueryMsg::GetNumber {}, DefaultImpl).unwrap();
        let number: u8 = from_binary(&result).unwrap();

        assert_eq!(number, expected_num);

        let result = query(
            deps,
            mock_env(),
            QueryMsg::StringComponent(string_component::QueryMsg::GetString {}),
            DefaultImpl,
        )
        .unwrap();

        let string: String = from_binary(&result).unwrap();
        assert_eq!(string, expected_str);
    }
}

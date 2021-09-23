use fadroma::scrt::{StdResult, Response, Storage, to_vec, from_slice};
use fadroma::cosmwasm_std;
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

        #[handle]
        fn set_number(number: u8) -> StdResult<Response>;

        #[query("number")]
        fn get_number() -> StdResult<u8>;
    }
}

pub mod number_contract {
    use super::*;
    use string_component::StringComponent;

    const KEY_NUMBER: &[u8] = b"number_data";

    #[contract_impl(path = "number_interface",
        component(path = "string_component")
    )]
    pub trait NumberContract {
        #[init]
        fn new(number: u8, string: String) -> StdResult<Response> {
            string_component::DefaultImpl::new(deps.storage, string)?;
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(Response::default())
        }

        #[handle]
        fn set_number(number: u8) -> StdResult<Response> {
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(Response::default())
        }

        #[query("number")]
        fn get_number() -> StdResult<u8> {
            let value = deps.storage.get(KEY_NUMBER).unwrap();

            from_slice(&value)
        }
    }
}

mod tests {
    use fadroma::cosmwasm_std::Deps;
    use fadroma::cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};

    use super::string_component;
    use super::number_contract::{init, handle, query, DefaultImpl};
    use super::number_interface::{InitMsg, HandleMsg, QueryMsg, QueryResponse};

    #[test]
    fn contract_functions() {
        let ref mut deps = mock_dependencies(&[]);
        let sender = "sender";

        let string = String::from("test");
        let number = 5;

        let msg = InitMsg {
            string: string.clone(),
            number
        };

        init(deps.as_mut(), mock_env(), mock_info(sender, &[]), msg, DefaultImpl).unwrap();

        test_queries(deps.as_ref(), number, string);

        let string = String::from("test_2");
        let number = 10;

        handle(deps.as_mut(), mock_env(), mock_info(sender, &[]), HandleMsg::SetNumber { number }, DefaultImpl).unwrap();
        handle(
            deps.as_mut(),
            mock_env(),
            mock_info(sender, &[]),
            HandleMsg::StringComponent(
                string_component::HandleMsg::SetString {
                    string: string.clone()
                }
            ),
            DefaultImpl
        )
        .unwrap();

        test_queries(deps.as_ref(), number, string);
    }

    fn test_queries(
        deps: Deps,
        expected_num: u8,
        expected_str: String
    ) {
        let result = query(deps, mock_env(), QueryMsg::GetNumber { }, DefaultImpl).unwrap();

        match result {
            QueryResponse::GetNumber { number } => {
                assert_eq!(number, expected_num);
            }
            _ => panic!("Expected QueryResponse::GetNumber")
        }

        let result = query(
            deps,
            mock_env(),
            QueryMsg::StringComponent(
                string_component::QueryMsg::GetString { }
            ),
            DefaultImpl
        ).unwrap();

        match result {
            QueryResponse::StringComponent(string_component::QueryResponse::GetString { string }) => {
                assert_eq!(string, expected_str);
            }
            _ => panic!("Expected QueryMsg::StringComponent(GetString)")
        }
    }
}

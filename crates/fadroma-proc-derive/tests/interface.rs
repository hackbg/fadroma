use cosmwasm_std::{StdResult, InitResponse, HandleResponse, Storage, to_vec, from_slice};
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
        fn new(number: u8, string: String) -> StdResult<InitResponse>;

        #[handle]
        fn set_number(number: u8) -> StdResult<HandleResponse>;

        #[query]
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
        fn new(number: u8, string: String) -> StdResult<InitResponse> {
            string_component::DefaultImpl::new(&mut deps.storage, string)?;
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(InitResponse::default())
        }

        #[handle]
        fn set_number(number: u8) -> StdResult<HandleResponse> {
            deps.storage.set(KEY_NUMBER, &to_vec(&number)?);

            Ok(HandleResponse::default())
        }

        #[query]
        fn get_number() -> StdResult<u8> {
            let value = deps.storage.get(KEY_NUMBER).unwrap();

            from_slice(&value)
        }
    }
}

mod tests {
    use cosmwasm_std::{Storage, Api, Querier, Extern, from_binary};
    use cosmwasm_std::testing::{mock_dependencies, mock_env};

    use super::string_component;
    use super::number_contract::{init, handle, query, DefaultImpl};
    use super::number_interface::{InitMsg, HandleMsg, QueryMsg};

    #[test]
    fn contract_functions() {
        let ref mut deps = mock_dependencies(20, &[]);
        let env = mock_env("sender", &[]);

        let string = String::from("test");
        let number = 5;

        let msg = InitMsg {
            string: string.clone(),
            number
        };

        init(deps, env.clone(), msg, DefaultImpl).unwrap();

        test_queries(deps, number, string);

        let string = String::from("test_2");
        let number = 10;

        handle(deps, env.clone(), HandleMsg::SetNumber { number }, DefaultImpl).unwrap();
        handle(
            deps,
            env,
            HandleMsg::StringComponent(
                string_component::HandleMsg::SetString {
                    string: string.clone()
                }
            ),
            DefaultImpl
        )
        .unwrap();

        test_queries(deps, number, string);
    }

    fn test_queries<S: Storage, A: Api, Q: Querier>(
        deps: &Extern<S,A,Q>,
        expected_num: u8,
        expected_str: String
    ) {
        let result = query(deps, QueryMsg::GetNumber { }, DefaultImpl).unwrap();
        let number: u8 = from_binary(&result).unwrap();

        assert_eq!(number, expected_num);

        let result = query(
            deps,
            QueryMsg::StringComponent(
                string_component::QueryMsg::GetString { }
            ),
            DefaultImpl
        ).unwrap();

        let string: String = from_binary(&result).unwrap();
        assert_eq!(string, expected_str);
    }
}

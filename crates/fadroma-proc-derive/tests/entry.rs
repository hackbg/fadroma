use cosmwasm_std::{self, from_slice, to_vec, Response, StdResult};
use fadroma_proc_derive::*;

const KEY_STRING: &[u8] = b"string_data";

#[contract(entry)]
pub trait StringComponent {
    #[init]
    fn new(string: String) -> StdResult<Response> {
        deps.storage.set(KEY_STRING, &to_vec(&string)?);

        Ok(Response::default())
    }

    #[handle]
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

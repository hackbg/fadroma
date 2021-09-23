use fadroma::scrt::{StdResult, Response, to_vec, from_slice};
use fadroma::cosmwasm_std;
use derive_contract::*;
use fadroma::schemars;
use serde;

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

    #[query("string")]
    fn get_string() -> StdResult<String> {
        let value = deps.storage.get(KEY_STRING).unwrap();

        from_slice(&value)
    }
}

use cosmwasm_std::{StdResult, HandleResponse, InitResponse, to_vec, from_slice};
use derive_contract::*;
use schemars;
use serde;

const KEY_STRING: &[u8] = b"string_data";

#[contract(entry)]
pub trait StringComponent {
    #[init]
    fn new(string: String) -> StdResult<InitResponse> {
        deps.storage.set(KEY_STRING, &to_vec(&string)?);

        Ok(InitResponse::default())
    }

    #[handle]
    fn set_string(string: String) -> StdResult<HandleResponse> {
        deps.storage.set(KEY_STRING, &to_vec(&string)?);

        Ok(HandleResponse::default())
    }

    #[query("string")]
    fn get_string() -> StdResult<String> {
        let value = deps.storage.get(KEY_STRING).unwrap();

        from_slice(&value)
    }
}

extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error};
use namada::address::Address;
use namada::string_encoding::Format;

#[wasm_bindgen]
pub struct API;

#[wasm_bindgen]
impl API {
    #[wasm_bindgen]
    pub fn decode_address (source: Uint8Array) -> Result<JsString, Error> {
        let mut bytes: Vec<u8> = vec![0u8; source.length() as usize];
        source.copy_to(&mut bytes);
        let address = Address::decode_bytes(&bytes)
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(address.encode().into())
    }
}

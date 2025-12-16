use crate::*;

const UNSPENDABLE: &str =
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";

#[wasm_bindgen]
pub fn cmr_to_p2tr (cmr: JsValue) -> Maybe<JsString> {
    console_error_panic_hook::set_once();
    let cmr: Vec<u8> = if Uint8Array::instanceof(&cmr) { 
        Uint8Array::unchecked_from_js(cmr).to_vec()
    } else if JsString::is_type_of(&cmr) {
        attempt!(hex::decode(&cmr.as_string().unwrap_or_default()))
    } else {
        return Err(Error::new("cmr must be Uint8Array or hex string"))
    };
    let tap  = TaprootBuilder::new();
    let tap  = attempt!(tap.add_leaf_with_ver(0, Script::from(cmr.to_vec()), LeafVersion::from_u8(0xbe).expect("constant leaf version")));
    let tap  = attempt!(tap.finalize(&secp256k1::SECP256K1, attempt!(secp256k1::XOnlyPublicKey::from_slice(&hex::decode(UNSPENDABLE).unwrap()))));
    let p2tr = Address::p2tr(secp256k1::SECP256K1, tap.internal_key(), tap.merkle_root(), None, &AddressParams::LIQUID_TESTNET);
    Ok(format!("{p2tr}").into())
}

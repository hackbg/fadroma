use crate::*;

#[wasm_bindgen]
pub fn cmr_to_p2tr (cmr: &Uint8Array) -> Maybe<JsString> {
    console_error_panic_hook::set_once();
    let tap  = TaprootBuilder::new();
    let tap  = attempt!(tap.add_leaf_with_ver(0, Script::from(cmr.to_vec()), LeafVersion::from_u8(0xbe).expect("constant leaf version")));
    let key  = attempt!(secp256k1::XOnlyPublicKey::from_slice(&hex::decode("50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0").unwrap()));
    let tap  = attempt!(tap.finalize(&secp256k1::SECP256K1, key));
    let p2tr = Address::p2tr(secp256k1::SECP256K1, tap.internal_key(), tap.merkle_root(), None, &AddressParams::LIQUID_TESTNET);
    Ok(format!("{p2tr}").into())
}

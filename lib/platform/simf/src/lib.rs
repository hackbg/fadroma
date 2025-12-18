extern crate console_error_panic_hook;
pub(crate) use std::sync::Arc;
pub(crate) use wasm_bindgen::prelude::*;
#[allow(unused)] pub(crate) use js_sys::{
    Array,
    Boolean,
    Error,
    JSON,
    JsString,
    Object,
    Reflect,
    Uint8Array,
};
#[allow(unused)] pub(crate) use simplicityhl::{
    dummy_env,
    Arguments,
    CompiledProgram,
    SatisfiedProgram,
    Value,
    WitnessValues,
    str::WitnessName,
    simplicity::{
        Amr,
        BitIter,
        Cmr,
        CommitNode,
        Ihr,
        human_encoding::Forest,
        jet::Elements,
    },
    elements::{
        Address,
        AddressParams,
        AssetId,
        AssetIssuance,
        LockTime,
        OutPoint,
        Script,
        Sequence,
        Transaction,
        TxIn,
        TxInWitness,
        TxOut,
        TxOutWitness,
        confidential::{
            Asset,
            Nonce,
            Value as ConfidentialValue
        },
        pset::PartiallySignedTransaction,
        secp256k1_zkp as secp256k1,
        taproot::{
            LeafVersion,
            TaprootBuilder,
            TaprootSpendInfo
        },
    }
};
/// Lame-ass workaround for WASM error "suffix"
macro_rules! attempt { ($expr:expr) => { $expr.map_err(|e|JsError::new(&e))? }; }
/// Standard result type
pub(crate) type Maybe<T> = Result<T, Error>;
/// Magic
pub(crate) const UNSPENDABLE: &str =
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";
/// Get property of JS object
macro_rules! get(($obj:expr, $key:expr) => {
    attempt!(Reflect::get(&$obj, &JsString::from($key).into()))});
/// Set property of JS object
macro_rules! set(($obj:expr, $key:expr, $value:expr) => {{
    let value = $value;
    attempt!(Reflect::set(&$obj, &JsString::from($key).into(), &value.into()));
    value}});
/// Iterate over object entries (unused?)
macro_rules! each {
    ($obj:expr => |$key:ident,$val:ident|$cb:expr) => {{
        Object::entries(&$obj.into()).for_each(&mut |entry, _, _| {
            let entry = Array::from(&entry);
            let $key = entry.get(0);
            let $val = entry.get(1);
            $cb
        });
    }}
}
// Above macros are available in subsequent modules
mod simf; pub use self::simf::*;

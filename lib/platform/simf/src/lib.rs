extern crate console_error_panic_hook;
pub(crate) use std::{
    str::FromStr,
    sync::Arc
};
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
        Txid,
        TxIn,
        TxInWitness,
        TxOut,
        TxOutWitness,
        confidential::{
            Asset,
            Nonce,
            Value as TxValue
        },
        encode::deserialize as deserialize_tx,
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
pub(crate) type Maybe<T> = Result<T, JsError>;
/// Get property of JS object
macro_rules! get(
    ($obj:expr, $key:expr) => {
        Reflect::get(&$obj, &JsString::from($key).into())
            .map_err(|_e|JsError::new(&format!("failed to get property {}", $key)))? };
    ($obj:expr, $key:expr, $fn:expr) => {
        ($fn)(Reflect::get(&$obj, &JsString::from($key).into())
            .map_err(|_e|JsError::new(&format!("failed to get property {}", $key)))?) };);
/// Set property of JS object
macro_rules! set(($obj:expr, $key:expr, $value:expr) => {{
    let value = $value;
    Reflect::set(&$obj, &JsString::from($key).into(), &value.clone().into())
        .map_err(|_e|JsError::new(&format!("failed to set property: {}", $key)))?;
    value
}});
/// Construct an object
macro_rules! obj(($($id:literal = $val:expr),+ $(,)?) => {{
    let object = Object::new();
    $(set!(object, $id, $val);)+
    object
}});
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
/// Map missing values to friendly [JsError]s.
macro_rules! required (
    ($expr:expr)=>{
        $expr.ok_or(JsError::new(&format!("{}: not found", stringify!($expr))))};
    ($msg:literal: $expr:expr)=>{
        $expr.ok_or(JsError::new(&format!("{}: {}", stringify!($expr), $msg)))};
);
/// Map failures  to friendly [JsError]s.
macro_rules! expected {
    ($msg:literal: $expr:expr) => {
        $expr.map_err(|e|JsError::new(&format!("failed to {}: {e}", $msg)))
    };
}
// Above macros are available in subsequent modules
mod simf; pub use self::simf::*;

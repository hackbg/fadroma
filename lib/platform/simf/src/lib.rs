extern crate console_error_panic_hook;
pub(crate) use std::{
    str::FromStr,
    sync::Arc
};
pub(crate) use wasm_bindgen::prelude::*;
pub(crate) use web_sys::console::{log_1, warn_1};
#[allow(unused)] pub(crate) use js_sys::{
    Array,
    BigInt,
    Boolean,
    Error,
    JSON,
    JsString,
    Number,
    Object,
    Reflect,
    Uint8Array,
};
#[allow(unused)] pub(crate) use bitcoin_hashes::Hash;
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
        jet::elements::{ElementsEnv, ElementsUtxo},
    },
    elements::{
        self,
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
        hash_types::BlockHash,
        pset::{
            PartiallySignedTransaction,
            serialize::Serialize,
        },
        secp256k1_zkp as secp256k1,
        taproot::{
            ControlBlock,
            LeafVersion,
            TaprootBuilder,
            TaprootSpendInfo
        },
    }
};
/// Standard result type
pub(crate) type Maybe<T> = Result<T, JsError>;
/// Log to JS console.
#[allow(unused)] macro_rules! log(($msg:literal $(, $expr:expr)*) => {
    log_1(&format!($msg $(, $expr)*).into())});
/// Log a warning to the JS console.
#[allow(unused)] macro_rules! warn(($msg:literal $(, $expr:expr)*) => {
    warn_1(&format!($msg $(, $expr)*).into())});
/// Construct throwable error
macro_rules! err(($msg:literal $(, $expr:expr)*) => {
    Err(JsError::new(&format!($msg $(, $expr)*))) });
/// Return [JsError] if expression evaluates to false:
macro_rules! asserted(($expr:expr) => {
    if !$expr { return err!("assertion failed: {}", stringify!($expr)) } });
/// Map `Err` to friendly [JsError].
macro_rules! expected(($msg:literal: $expr:expr) => {
    $expr.map_err(|_e|JsError::new(&format!("failed: {}", $msg))) });
/// Map `None` to friendly [JsError].
macro_rules! required(
    ($expr:expr) => {
        $expr.ok_or(JsError::new(&format!("{}: not found", stringify!($expr)))) };
    ($msg:literal: $expr:expr) => {
        $expr.ok_or(JsError::new(&format!("{}: {}", stringify!($expr), $msg))) });
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
    value }});
/// Construct an object
macro_rules! obj(($($id:literal = $val:expr),+ $(,)?) => {{
    let object = Object::new();
    $(set!(object, $id, JsValue::from($val));)+
    object }});
// Above macros are available in subsequent modules:
mod simf; pub use self::simf::*;
mod simf_impl; pub use self::simf_impl::*;
mod simf_parse; pub use self::simf_parse::*;

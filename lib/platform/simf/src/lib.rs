extern crate console_error_panic_hook;
pub(crate) use wasm_bindgen::prelude::*;
pub(crate) use js_sys::{JsString, Object, Error, Reflect, Boolean, JSON};
pub(crate) use simplicityhl::{
    dummy_env,
    Arguments, CompiledProgram, SatisfiedProgram, WitnessValues, Value,
    str::WitnessName,
    simplicity::{
        CommitNode, BitIter,
        human_encoding::Forest,
        jet::Elements,
    },
};
pub(crate) type Maybe<T> = Result<T, Error>;
macro_rules! attempt { ($expr:expr) => { $expr.map_err(|e|Error::new(&format!("{e}")))? } }
macro_rules! get { ($obj:expr, $key:expr) => { Reflect::get(&$obj, &JsString::from($key).into())? } }
macro_rules! set { ($obj:expr, $key:expr, $value:expr) => {{ Reflect::set(&$obj, &JsString::from($key).into(), &$value.into())?; }} }
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

mod simf; pub use self::simf::*;

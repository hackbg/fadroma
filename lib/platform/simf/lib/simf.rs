use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use js_sys::{JsString, Object, Error, Reflect, Boolean, Array, JSON};
use simplicityhl::{
    dummy_env,
    Arguments, CompiledProgram, SatisfiedProgram, WitnessValues, Value,
    str::WitnessName,
    simplicity::{
        CommitNode, BitIter,
        human_encoding::Forest,
        jet::Elements,
        elements::{
            taproot::{LeafVersion, TaprootBuilder, TaprootSpendInfo},
            Address, AddressParams, Script, secp256k1_zkp as secp256k1,
        },
    },
};
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

pub type Maybe<T> = Result<T, Error>;

pub fn set_panic_hook () {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn build (source: JsString, options: Object) -> Maybe<Object> {
    let result         = Object::new();
    let source         = set_build_source(&result, &source)?;
    let (debug, prune) = set_build_options(&result, &options)?;
    let arguments      = set_build_arguments(&result, &options)?;
    let compiled       = attempt!(CompiledProgram::new(source, arguments, debug));
    let _address       = set_build_address(&result, &compiled)?;
    let witness        = set_build_witness(&result, &options)?;
    let program_bytes  = set_build_bytes(&result, &compiled, &witness, prune)?;
    let _assembly      = set_build_assembly(&result, program_bytes)?;
    Ok(result)
}

fn set_build_source (result: &Object, source: &JsString) -> Maybe<String> {
    let source = source.as_string().unwrap_or_default();
    set!(result, "source", JsString::from(source.clone()));
    Ok(source)
}

fn set_build_options (result: &Object, options: &Object) -> Maybe<(bool, bool)> {
    let debug = get!(options, "debug").is_truthy();
    set!(result, "debug", Boolean::from(debug));
    let prune = get!(options, "prune").is_truthy();
    set!(result, "prune", Boolean::from(prune));
    Ok((debug, prune))
}

fn set_build_arguments (result: &Object, options: &Object) -> Maybe<Arguments> {
    let arguments = get!(options, "arguments");
    let arguments: Option<Arguments> = if arguments.is_object() {
        set!(result, "arguments", arguments.clone());
        if let Some(s) = JSON::stringify(&arguments)?.as_string() {
            Some(attempt!(serde_json::from_str(&s)))
        } else {
            None
        }
    } else {
        None
    };
    Ok(arguments.unwrap_or_default())
}

fn set_build_address (result: &Object, compiled: &CompiledProgram) -> Maybe<Address> {
    let address = compute_address(&compiled)?;
    set!(result, "address", format!("{address}"));
    Ok(address)
}

pub fn compute_address (compiled: &CompiledProgram) -> Maybe<Address> {
    let script = Script::from(compiled.commit().cmr().as_ref().to_vec());
    let tap = TaprootBuilder::new();
    let tap = attempt!(tap.add_leaf_with_ver(0, script,
        LeafVersion::from_u8(0xbe).expect("constant leaf version")));
    let tap = attempt!(tap.finalize(&secp256k1::SECP256K1,
        secp256k1::XOnlyPublicKey::from_slice(&hex::decode(
            "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0"
        ).unwrap()).unwrap()));
    Ok(Address::p2tr(secp256k1::SECP256K1, tap.internal_key(), tap.merkle_root(),
        None, &AddressParams::LIQUID_TESTNET))
}

fn set_build_witness (result: &Object, options: &Object) -> Maybe<Option<WitnessValues>> {
    let witness = get!(options, "witness");
    Ok(if witness.is_object() {
        set!(result, "witness", witness.clone());
        if let Some(s) = JSON::stringify(&witness)?.as_string() {
            Some(attempt!(serde_json::from_str(&s)))
        } else {
            None
        }
    } else {
        None
    })
}

fn set_build_bytes (
    result:   &Object,
    compiled: &CompiledProgram,
    witness:  &Option<WitnessValues>,
    prune:    bool
) -> Maybe<Vec<u8>> {
    //let program_bytes = vec![];
    let program_bytes = if let Some(witness) = witness {
        let satisfied = attempt!(if prune {
            let env = dummy_env::dummy();
            compiled.satisfy_with_env(witness.clone(), Some(&env))
        } else {
            compiled.satisfy(witness.clone())
        });
        let node = satisfied.redeem();
        let (program_bytes, witness_bytes) = node.encode_to_vec();
        let bounds = node.bounds();
        set!(result, "witness", witness_bytes.clone());
        set!(result, "bounds", {
            let object = Object::new();
            set!(object, "extra_cells",  bounds.extra_cells);
            set!(object, "extra_frames", bounds.extra_frames);
            set!(object, "cost",         format!("{}", bounds.cost));
            object
        });
        let padding = node.bounds().cost.get_padding(&vec![
            witness_bytes.clone(),
            program_bytes.clone()
        ]);
        set!(result, "padding", padding.unwrap_or_default().len());
        program_bytes
    } else {
        compiled.commit().encode_to_vec()
    };
    set!(result, "program", program_bytes.clone());
    Ok(program_bytes)
}

fn set_build_assembly (result: &Object, program_bytes: Vec<u8>) -> Maybe<Forest<Elements>> {
    let decoded = attempt!(CommitNode::decode(BitIter::from(program_bytes.into_iter())));
    let assembly = Forest::<Elements>::from_program(decoded);
    set!(result, "assembly", assembly.string_serialize());
    Ok(assembly)
}

use crate::*;

#[wasm_bindgen]
pub fn build (source: JsString, options: Object) -> Maybe<Object> {
    console_error_panic_hook::set_once();
    let result         = Object::new();
    let source         = set_build_source(&result, &source)?;
    let (debug, prune) = set_build_options(&result, &options)?;
    let arguments      = set_build_arguments(&result, &options)?;
    let compiled       = attempt!(CompiledProgram::new(source, arguments, debug));
    set_build_output(&result, &compiled)?;
    Ok(result)
    //unimplemented!();
    //let witness        = set_build_witness(&result, &options)?;
    //let program_bytes  = set_build_bytes(&result, &compiled, &witness, prune)?;
    //let _assembly      = set_build_assembly(&result, program_bytes)?;
    //Ok(result)
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

fn set_build_output (result: &Object, compiled: &CompiledProgram) -> Maybe<()> {
    let commit  = compiled.commit();
    set!(result, "commit", format!("{}", hex::encode(&commit.to_vec_without_witness())));
    let (cmr, amr, ihr) = (commit.cmr(), commit.amr(), commit.ihr());
    set!(result, "cmr", format!("{}", hex::encode(&cmr.to_byte_array())));
    set!(result, "amr", format!("{}", hex::encode(&amr.map(|x|x.to_byte_array()).unwrap_or_default())));
    set!(result, "ihr", format!("{}", hex::encode(&ihr.map(|x|x.to_byte_array()).unwrap_or_default())));
    Ok(())
}

//fn set_build_witness (result: &Object, options: &Object) -> Maybe<Option<WitnessValues>> {
    //let witness = get!(options, "witness");
    //Ok(if witness.is_object() {
        //set!(result, "witness", witness.clone());
        //if let Some(s) = JSON::stringify(&witness)?.as_string() {
            //Some(attempt!(serde_json::from_str(&s)))
        //} else {
            //None
        //}
    //} else {
        //None
    //})
//}

//fn set_build_bytes (
    //result:   &Object,
    //compiled: &CompiledProgram,
    //witness:  &Option<WitnessValues>,
    //prune:    bool
//) -> Maybe<Vec<u8>> {
    ////let program_bytes = vec![];
    //let program_bytes = if let Some(witness) = witness {
        //let satisfied = attempt!(if prune {
            //let env = dummy_env::dummy();
            //compiled.satisfy_with_env(witness.clone(), Some(&env))
        //} else {
            //compiled.satisfy(witness.clone())
        //});
        //let node = satisfied.redeem();
        //let (program_bytes, witness_bytes) = node.encode_to_vec();
        //let bounds = node.bounds();
        //set!(result, "witness", witness_bytes.clone());
        //set!(result, "bounds", {
            //let object = Object::new();
            //set!(object, "extra_cells",  bounds.extra_cells);
            //set!(object, "extra_frames", bounds.extra_frames);
            //set!(object, "cost",         format!("{}", bounds.cost));
            //object
        //});
        //let padding = node.bounds().cost.get_padding(&vec![
            //witness_bytes.clone(),
            //program_bytes.clone()
        //]);
        //set!(result, "padding", padding.unwrap_or_default().len());
        //program_bytes
    //} else {
        //compiled.commit().encode_to_vec()
    //};
    //set!(result, "program", program_bytes.clone());
    //Ok(program_bytes)
//}

//fn set_build_assembly (
    //result: &Object,
    //program_bytes: Vec<u8>
//) -> Maybe<Forest<Elements>> {
    //let decoded = attempt!(CommitNode::decode(BitIter::from(program_bytes.into_iter())));
    //let assembly = Forest::<Elements>::from_program(decoded);
    //set!(result, "assembly", assembly.string_serialize());
    //Ok(assembly)
//}

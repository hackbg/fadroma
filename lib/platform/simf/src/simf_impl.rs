use crate::*;

/// Generate P2TR (pay-to-taproot) [Address] from a [Script]'s [Cmr].
pub fn script_to_p2tr (script: Script) -> Maybe<Address> {
    Ok(taproot_to_p2tr(&script_to_taproot(script)?))
}

/// Generate P2TR (pay-to-taproot) [Address] from [TaprootSpendInfo].
pub fn taproot_to_p2tr (
    tap: &TaprootSpendInfo,
    // TODO: kind: Option<AddressParams>
) -> Address {
    let key = tap.internal_key();
    let root = tap.merkle_root();
    Address::p2tr(secp256k1::SECP256K1, key, root, None, &AddressParams::LIQUID_TESTNET)
}

/// Generate [TaprootSpendInfo] for a given [Script].
pub fn script_to_taproot (script: Script) -> Maybe<TaprootSpendInfo> {
    let tap = TaprootBuilder::new();
    let ver = expected!("use constant leaf version": LeafVersion::from_u8(0xbe))?;
    let key = expected!("parse unspendable key": hex::decode(
        // FIXME: Magic constant (unspendable key)
        "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0"
    ))?;
    let key = expected!("parse unspendable key": secp256k1::XOnlyPublicKey::from_slice(&key))?;
    let tap = expected!("taproot: add leaf": tap.add_leaf_with_ver(0, script, ver))?;
    let tap = expected!("taproot: finalize": tap.finalize(&secp256k1::SECP256K1, key))?;
    Ok(tap)
}

pub fn tx_script_ins (previous_output: OutPoint) -> Vec<TxIn> {
    vec![TxIn {
        previous_output,
        is_pegin:       false,
        script_sig:     Script::new(),
        sequence:       Sequence::MAX,
        asset_issuance: AssetIssuance::null(),
        witness:        TxInWitness::empty(),
    }]
}

pub fn tx_script_outs (
    asset_id: AssetId,
    program:  &Address,
    balance:  u64,
    spender:  Address,
    value:    u64,
    cost:     u64,
) -> Maybe<Vec<TxOut>> {
    asserted!(value + cost <= balance);
    let fee = TxOut::new_fee(cost, asset_id);
    let spent = tx_script_out(asset_id, spender, value);
    Ok(if value + cost == balance {
        log!("Will spend {value} + {cost} = {balance}");
        vec![fee, spent]
    } else {
        let remain = balance - (value + cost);
        log!("Will spend {value} + {cost} = {balance} - {remain}");
        let remain = tx_script_out(asset_id, program.clone(), remain);
        vec![fee, spent, remain]
    })
}

pub fn tx_script_out (asset_id: AssetId, to: Address, value: u64) -> TxOut {
    TxOut {
        script_pubkey: to.script_pubkey(),
        value:   TxValue::Explicit(value),
        asset:   Asset::Explicit(asset_id),
        nonce:   Nonce::Null,
        witness: TxOutWitness::default(),
    }
}

pub fn final_script_witness (
    control: Vec<u8>, script: Vec<u8>, satisfied: SatisfiedProgram,
) -> Maybe<Vec<Vec<u8>>> {
    let redeem = satisfied.redeem();
    let bounds = redeem.bounds();
    asserted!(bounds.cost.is_consensus_valid());
    let (program, witness) = redeem.encode_to_vec();
    let mut final_script_witness = vec![witness, program, script, control];
    // Add padding to the script witness if budget is exceeded
    if let Some(padding_bytes) = bounds.cost.get_padding(&final_script_witness) {
        // Annex has to be removed from the stack
        // https://github.com/ElementsProject/elements/blob/9748c00c3344b815d75c4b5c251b341fb34fa80f/src/script/interpreter.cpp#L3275
        final_script_witness.push(padding_bytes);
    } else {
        //println!("No padding needed");
    }
    asserted!(bounds.cost.is_budget_valid(&final_script_witness));
    Ok(final_script_witness)
}

pub fn find_utxo (tx: &Transaction, p2tr: &Address) -> Maybe<(OutPoint, TxOut)> {
    let mut previous: Option<OutPoint> = Default::default();
    let mut utxo:     Option<TxOut>    = Default::default();
    for (vout, output) in tx.output.iter().enumerate() {
        debug!("vout={vout} output={output:?} value={:?}", &output.value);
        if output.script_pubkey == p2tr.script_pubkey() {
            previous = Some(OutPoint::new(tx.txid(), vout as u32));
            utxo     = Some(output.clone());
            break;
        }
    }
    Ok((required!(previous)?, required!(utxo)?))
}

pub fn script_control_block (script: &Script) -> Maybe<Vec<u8>> {
    let tap = script_to_taproot(script.clone())?;
    let ver = expected!("leaf version mismatch": LeafVersion::from_u8(0xbe))?;
    let block = required!("control block": tap.control_block(&(script.clone(), ver)))?;
    let bytes = block.serialize();
    // (control[0] & TAPROOT_LEAF_MASK) == TAPROOT_LEAF_TAPSIMPLICITY)
    assert_eq!(bytes[0] & 0xfe, 0xbe);
    Ok(bytes)
}

pub fn tx_finalize (tx: Transaction, wits: Vec<Vec<u8>>) -> Maybe<Transaction> {
    let mut tx = PartiallySignedTransaction::from_tx(tx);
    tx.inputs_mut()[0].final_script_witness = Some(wits);
    expected!("extract final tx": tx.extract_tx())
}

//#[wasm_bindgen]
//pub fn compile (source: JsString, options: Object) -> Maybe<Object> {
    //console_error_panic_hook::set_once();
    //let result         = Object::new();
    //let source         = source.as_string().unwrap_or_default();
    //let (debug, prune) = set_build_options(&result, &options)?;
    //let arguments      = set_build_arguments(&result, &options)?;
    //let compiled       = attempt!(CompiledProgram::new(source, arguments, debug));
    //let commit  = compiled.commit();
    //set!(result, "commit", format!("{}", hex::encode(&commit.to_vec_without_witness())));
    //let (cmr, amr, ihr) = (commit.cmr(), commit.amr(), commit.ihr());
    //set!(result, "cmr", format!("{}", hex::encode(&cmr.to_byte_array())));
    //set!(result, "amr", format!("{}", hex::encode(&amr.map(|x|x.to_byte_array()).unwrap_or_default())));
    //set!(result, "ihr", format!("{}", hex::encode(&ihr.map(|x|x.to_byte_array()).unwrap_or_default())));
    //let tap = TaprootBuilder::new();
    //let tap = attempt!(tap.add_leaf_with_ver(
        //0,
        //Script::from(cmr.to_byte_array().to_vec()),
        //LeafVersion::from_u8(0xbe).expect("constant leaf version")
    //));
    //let tap = attempt!(tap.finalize(
        //&secp256k1::SECP256K1,
        //attempt!(secp256k1::XOnlyPublicKey::from_slice(&hex::decode(UNSPENDABLE).unwrap())
    //)));
    //let p2tr = cmr_to_p2tr_impl(&cmr.to_byte_array());
    //set!(result, "p2tr", format!("{p2tr}"));
    //Ok(result)
    ////unimplemented!();
    ////let witness        = set_build_witness(&result, &options)?;
    ////let program_bytes  = set_build_bytes(&result, &compiled, &witness, prune)?;
    ////let _assembly      = set_build_assembly(&result, program_bytes)?;
    ////Ok(result)
//}


//fn set_build_source (result: &Object, source: &JsString) -> Maybe<String> {
    //let source = source.as_string().unwrap_or_default();
    //set!(result, "source", JsString::from(source.clone()));
    //Ok(source)
//}

//fn set_build_options (result: &Object, options: &Object) -> Maybe<(bool, bool)> {
    //let debug = get!(options, "debug").is_truthy();
    //set!(result, "debug", Boolean::from(debug));
    //let prune = get!(options, "prune").is_truthy();
    //set!(result, "prune", Boolean::from(prune));
    //Ok((debug, prune))
//}

//fn set_build_arguments (result: &Object, options: &Object) -> Maybe<Arguments> {
    //let arguments = get!(options, "arguments");
    //let arguments: Option<Arguments> = if arguments.is_object() {
        //set!(result, "arguments", arguments.clone());
        //if let Some(s) = JSON::stringify(&arguments)?.as_string() {
            //Some(attempt!(serde_json::from_str(&s)))
        //} else {
            //None
        //}
    //} else {
        //None
    //};
    //Ok(arguments.unwrap_or_default())
//}

////fn set_build_witness (result: &Object, options: &Object) -> Maybe<Option<WitnessValues>> {
    ////let witness = get!(options, "witness");
    ////Ok(if witness.is_object() {
        ////set!(result, "witness", witness.clone());
        ////if let Some(s) = JSON::stringify(&witness)?.as_string() {
            ////Some(attempt!(serde_json::from_str(&s)))
        ////} else {
            ////None
        ////}
    ////} else {
        ////None
    ////})
////}

////fn set_build_bytes (
    ////result:   &Object,
    ////compiled: &CompiledProgram,
    ////witness:  &Option<WitnessValues>,
    ////prune:    bool
////) -> Maybe<Vec<u8>> {
    //////let program_bytes = vec![];
    ////let program_bytes = if let Some(witness) = witness {
        ////let satisfied = attempt!(if prune {
            ////let env = dummy_env::dummy();
            ////compiled.satisfy_with_env(witness.clone(), Some(&env))
        ////} else {
            ////compiled.satisfy(witness.clone())
        ////});
        ////let node = satisfied.redeem();
        ////let (program_bytes, witness_bytes) = node.encode_to_vec();
        ////let bounds = node.bounds();
        ////set!(result, "witness", witness_bytes.clone());
        ////set!(result, "bounds", {
            ////let object = Object::new();
            ////set!(object, "extra_cells",  bounds.extra_cells);
            ////set!(object, "extra_frames", bounds.extra_frames);
            ////set!(object, "cost",         format!("{}", bounds.cost));
            ////object
        ////});
        ////let padding = node.bounds().cost.get_padding(&vec![
            ////witness_bytes.clone(),
            ////program_bytes.clone()
        ////]);
        ////set!(result, "padding", padding.unwrap_or_default().len());
        ////program_bytes
    ////} else {
        ////compiled.commit().encode_to_vec()
    ////};
    ////set!(result, "program", program_bytes.clone());
    ////Ok(program_bytes)
////}

////fn set_build_assembly (
    ////result: &Object,
    ////program_bytes: Vec<u8>
////) -> Maybe<Forest<Elements>> {
    ////let decoded = attempt!(CommitNode::decode(BitIter::from(program_bytes.into_iter())));
    ////let assembly = Forest::<Elements>::from_program(decoded);
    ////set!(result, "assembly", assembly.string_serialize());
    ////Ok(assembly)
////}


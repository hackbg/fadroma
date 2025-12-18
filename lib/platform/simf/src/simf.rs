use crate::*;
#[wasm_bindgen] pub struct Program {
    source:    Arc<str>,
    compiled:  CompiledProgram,
    debug:     bool,
    prune:     bool,
    arguments: Arguments,
    cmr:       Cmr,
    amr:       Option<Amr>,
    ihr:       Option<Ihr>,
    commit:    Arc<CommitNode<Elements>>,
    p2tr:      Address,
}
#[wasm_bindgen] impl Program {
    #[wasm_bindgen] pub fn compile (source: JsString, options: Object) -> Maybe<Self> {
        console_error_panic_hook::set_once();
        let result    = Object::new();
        let source    = source.as_string().unwrap_or_default();
        let debug     = get!(options, "debug").is_truthy();
        let prune     = get!(options, "prune").is_truthy();
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
        let compiled  = attempt!(CompiledProgram::new(source, arguments, debug));
        let commit    = compiled.commit();
        Ok(Self {
            source: source.into(),
            debug,
            prune,
            arguments,
            compiled: attempt!(CompiledProgram::new(source, arguments, debug)),
            cmr:      commit.cmr(),
            amr:      commit.amr(),
            ihr:      commit.ihr(),
            commit,
            p2tr:     cmr_to_p2tr_impl(&commit.cmr().to_byte_array())
        })
    }
    #[wasm_bindgen] pub fn spend (
        txid: JsString,
        dest: JsString,
        prev: (),
        utxo: (),
        args: WithdrawArgs,
        wits: Option<WitnessValues>
    ) -> Maybe<Transaction> {
        let txid:   Txid          = attempt!(Txid::from_str(&txid));
        let dest:   Address       = attempt!(Address::from_str(&dest));
        let wits:   WitnessValues = wits.unwrap_or_default(); // TODO parse
        let script: Script        = Script::from(self.compiled.commit().cmr().as_ref().to_vec())?;
        let value = attempt!(utxo.value.explicit().ok_or(Error::new("UTXO value is not explicit")));
        let fee   = 2000;
        let tx_in = TxIn { previous_output: prev, is_pegin: false, script_sig: Script::new(), sequence: Sequence::MAX, asset_issuance: AssetIssuance::null(), witness: TxInWitness::empty(), };
        let asset = AssetId::from_slice(&hex::decode("499a818545f6bae39fc03b637f2a4e1e64e590cac1bc3a6f6d71aa4443654c14").unwrap()).unwrap();
        let tx_0  = TxOut { value: Value::Explicit(value - fee), script_pubkey: dest.script_pubkey(), asset: Asset::Explicit(asset.clone()), nonce: Nonce::Null, witness: TxOutWitness::default(), };
        let tx_1  = TxOut::new_fee(fee, asset);
        let tx    = Transaction { version: 2, lock_time: LockTime::ZERO.into(), input: vec![tx_in], output: vec![tx_0, tx_1], };
        let tap   = TaprootBuilder::new();
        let tap   = tap.add_leaf_with_ver(0, script.clone(), simplicity_leaf_version()).map_err(|e| anyhow!("Failed to add leaf to taproot builder: {}", e))?;
        let tap   = tap.finalize(&secp256k1::SECP256K1, unspendable_key()).map_err(|e| anyhow!("Failed to finalize taproot builder: {}", e))?;
        let redeem_node = self.compiled.satisfy_with_env(wits, Some(&dummy_env::dummy())).map_err(|e| anyhow::anyhow!("Failed to satisfy program: {}", e))?.redeem();
        let (bounds, (program_bytes, witness_bytes)) = (redeem_node.bounds(), redeem_node.encode_to_vec());
        let mut final_script_witness = vec![
            witness_bytes, program_bytes, script.into_bytes(),
            tap.control_block(&(script.clone(), simplicity_leaf_version())).unwrap().serialize()
        ];
        assert_eq!(final_script_witness[3][0] & 0xfe, 0xbe); // (control[0] & TAPROOT_LEAF_MASK) == TAPROOT_LEAF_TAPSIMPLICITY)
        if !bounds.cost.is_consensus_valid() {
            return Err(anyhow::anyhow!(
                "Program cost exceeded the maximum allowed cost, cost = {}",
                bounds.cost
            ));
        }
        // Add padding to the script witness if budget is exceeded
        if let Some(padding) = bounds.cost.get_padding(&final_script_witness) {
            // Annex has to be removed from the stack
            // https://github.com/ElementsProject/elements/blob/9748c00c3344b815d75c4b5c251b341fb34fa80f/src/script/interpreter.cpp#L3275
            final_script_witness.push(padding);
        } else {
            println!("No padding needed");
        }
        if !bounds.cost.is_budget_valid(&final_script_witness) {
            return Err(anyhow::anyhow!("Budget exceeded, cost = {}", bounds.cost));
        }
        let mut partial_tx = PartiallySignedTransaction::from_tx(tx);
        partial_tx.inputs_mut()[0].final_script_witness = Some(final_script_witness);
        Ok(partial_tx.extract_tx().unwrap())
    }
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

//#[wasm_bindgen]
//pub fn cmr_to_p2tr (cmr: JsValue) -> Maybe<JsString> {
    //console_error_panic_hook::set_once();
    //let cmr: Vec<u8> = if Uint8Array::instanceof(&cmr) { 
        //Uint8Array::unchecked_from_js(cmr).to_vec()
    //} else if JsString::is_type_of(&cmr) {
        //attempt!(hex::decode(&cmr.as_string().unwrap_or_default()))
    //} else {
        //return Err(Error::new("cmr must be Uint8Array or hex string"))
    //};
    //let cmr  = attempt!(bytes_to_vec(cmr));
    //let p2tr = attempt!(cmr_to_p2tr_impl(cmr.as_slice()));
    //Ok(format!("{p2tr}").into())
//}

//fn bytes_to_vec (bytes: JsValue) -> Maybe<Vec<u8>> {
    //if Uint8Array::instanceof(&cmr) { 
        //Uint8Array::unchecked_from_js(cmr).to_vec()
    //} else if JsString::is_type_of(&cmr) {
        //attempt!(hex::decode(&cmr.as_string().unwrap_or_default()))
    //} else {
        //return Err(Error::new("need Uint8Array or hex string"))
    //}
//}

//fn cmr_to_p2tr_impl (cmr: &[u8]) -> Maybe<Address> {
    //let tap = TaprootBuilder::new();
    //let tap = attempt!(tap.add_leaf_with_ver(0, Script::from(cmr.to_vec()), LeafVersion::from_u8(0xbe).expect("constant leaf version")));
    //let tap = attempt!(tap.finalize(&secp256k1::SECP256K1, attempt!(secp256k1::XOnlyPublicKey::from_slice(&hex::decode(UNSPENDABLE).unwrap()))));
    //Ok(Address::p2tr(secp256k1::SECP256K1, tap.internal_key(), tap.merkle_root(), None, &AddressParams::LIQUID_TESTNET))
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

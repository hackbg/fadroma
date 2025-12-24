use crate::*;

/// Create a SimplicityHL P2TR address from the [Cmr]
/// (Commitment Merkle root) of a compiled Simplicity program.
#[wasm_bindgen]
pub fn cmr_to_p2tr (cmr: JsValue) -> Maybe<JsString> {
    console_error_panic_hook::set_once();
    let tap = script_to_taproot(Script::from(bytes_to_vec(cmr)?))?;
    Ok(format!("{}", taproot_to_p2tr(&tap)).into())
}

/// Helper for accepting either [Uint8Array] or base16 string.
fn bytes_to_vec (cmr: JsValue) -> Maybe<Vec<u8>> {
    if Uint8Array::instanceof(&cmr) { 
        Ok(Uint8Array::unchecked_from_js(cmr).to_vec())
    } else if JsString::is_type_of(&cmr) {
        expected!("decode cmr": hex::decode(&required!(cmr.as_string())?))
    } else {
        return Err(JsError::new("need Uint8Array or hex string"))
    }
}

/// Generate P2TR (pay-to-taproot) address from [TaprootSpendInfo].
fn taproot_to_p2tr (tap: &TaprootSpendInfo) -> Address {
    Address::p2tr(
        secp256k1::SECP256K1,
        tap.internal_key(),
        tap.merkle_root(),
        None,
        &AddressParams::LIQUID_TESTNET
    )
}

/// Generate [TaprootSpendInfo] for a given script.
fn script_to_taproot (script: Script) -> Maybe<TaprootSpendInfo> {
    let tap = TaprootBuilder::new();
    let ver = expected!("use constant leaf version": LeafVersion::from_u8(0xbe))?;
    let key = expected!("parse unspendable key": hex::decode(UNSPENDABLE))?;
    let key = expected!("parse unspendable key": secp256k1::XOnlyPublicKey::from_slice(&key))?;
    let tap = expected!("taproot: add leaf": tap.add_leaf_with_ver(0, script, ver))?;
    let tap = expected!("taproot: finalize": tap.finalize(&secp256k1::SECP256K1, key))?;
    Ok(tap)
}

/// Compile a SimplicityHL program.
#[wasm_bindgen] pub fn compile (source: JsString, options: Object) -> Maybe<Program> {
    console_error_panic_hook::set_once();
    let source = source.as_string().unwrap_or_default();
    let mut debug = false;
    let mut prune = false;
    let mut args  = Arguments::default();
    if options.is_object() {
        debug = get!(options, "debug", parse_bool);
        prune = get!(options, "prune", parse_bool);
        args  = get!(options, "args",  parse_args)?;
    }
    Program::new(&source, args, debug, prune)
}

/// A valid compiled SimplicityHL program.
#[wasm_bindgen(inspectable)] pub struct Program {
    source:   Arc<str>,
    compiled: CompiledProgram,
    debug:    bool,
    prune:    bool,
    args:     Arguments,
    commit:   Arc<CommitNode<Elements>>,
    p2tr:     Address,
    script:   Script,
}

impl Program {
    /// Internal constructor.
    fn new (source: &str, args: Arguments, debug: bool, prune: bool) -> Maybe<Self> {
        let compiled = CompiledProgram::new(source, args.clone(), debug);
        let compiled = expected!("compile failed": compiled)?;
        let commit = compiled.commit();
        let script = Script::from(commit.cmr().to_byte_array().to_vec());
        let source = source.into();
        let p2tr = taproot_to_p2tr(&script_to_taproot(script.clone())?);
        Ok(Self { source, p2tr, debug, prune, args, compiled, commit, script, })
    }
}

#[wasm_bindgen] impl Program {
    /// Programs have many properties, so we default to
    /// just stringifying them to the original source.
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string (&self) -> String {
        self.source.to_string()
    }
    /// Use this in JS to get the properties of the compiled program.
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json (&self) -> Object {
        self.try_to_json().unwrap_or_else(|e|JsValue::from(e).into())
    }
    fn try_to_json (&self) -> Maybe<Object> {
        Ok(obj! {
            "source" = self.source.to_string(),
            "debug"  = self.debug,
            "prune"  = self.prune,
            "args"   = serde_json::to_string(&self.args)?,
            "cmr"    = hex::encode(self.commit.cmr().to_byte_array()),
            "ihr"    = self.commit.ihr().map(|ihr|hex::encode(ihr.to_byte_array())),
            "amr"    = self.commit.amr().map(|ihr|hex::encode(ihr.to_byte_array())),
            "p2tr"   = self.p2tr.to_string(),
        })
    }
    /// Generate a spend transaction.
    #[wasm_bindgen] pub fn spend (&self, options: Object) -> Maybe<Object> {
        console_error_panic_hook::set_once();
        if !options.is_object() { return Err(JsError::new("options: not object")) }
        let tx_id:       Txid          = get!(options, "txId",        parse_tx_id)?;
        let tx_bytes:    Transaction   = get!(options, "txBytes",     parse_tx_bytes)?;
        let witness:     WitnessValues = get!(options, "witness",     parse_wits)?;
        let destination: Address       = get!(options, "destination", parse_addr)?;
        let (previous, utxo) = Self::find_utxo(tx_id, &tx_bytes, &destination)?;
        let value = required!("value not explicit": utxo.value.explicit())?;
        let Transaction { version, lock_time, input, output } =
            self.spend_impl(destination, previous, witness, value, 2000)?;
        Ok(obj! {
            "input"     = tx_ins_to_js_value(&input)?,
            "output"    = tx_outs_to_js_value(&output)?,
            "version"   = version,
            "lock_time" = match lock_time {
                LockTime::Blocks(height) => obj!("block" = height.to_consensus_u32()),
                LockTime::Seconds(time)  => obj!("seconds" = time.to_consensus_u32()),
            },
        })
    }
    fn find_utxo (tx_id: Txid, tx_bytes: &Transaction, destination: &Address) -> Maybe<(OutPoint, TxOut)> {
        let mut previous: Option<OutPoint> = Default::default();
        let mut utxo:     Option<TxOut>    = Default::default();
        for (vout, output) in tx_bytes.output.iter().enumerate() {
            web_sys::console::log_1(&format!("{vout:?} {output:?} {destination:?} {:?}", &destination.script_pubkey()).into());
            if output.script_pubkey == destination.script_pubkey() {
                previous = Some(OutPoint::new(tx_id, vout as u32));
                utxo     = Some(output.clone());
                break;
            }
        }
        Ok((required!(previous)?, required!(utxo)?))
    }
    fn spend_impl (
        &self,
        dest: Address,
        prev: OutPoint,
        wits: WitnessValues,
        val: u64,
        fee: u64,
    ) -> Maybe<Transaction> {
        let mut partial_tx = Self::script_to_transaction(prev, dest, val, fee)?;
        partial_tx.inputs_mut()[0].final_script_witness = Some(
            Self::final_script_witness(
                self.control_bytes()?,
                self.script.clone().into_bytes(),
                self.compiled.satisfy_with_env(
                    wits,
                    Some(&dummy_env::dummy())).map_err(
                        |e|JsError::new(&format!("does not satisfy: {e}"))
                    )?,
                )?);
        partial_tx.extract_tx()
            .map_err(|e|JsError::new(&format!("could not extract final tx: {e}")))
    }
    fn final_script_witness (
        control_bytes: Vec<u8>,
        script_bytes:  Vec<u8>,
        satisfied:     SatisfiedProgram,
    ) -> Maybe<Vec<Vec<u8>>> {
        let redeem = satisfied.redeem();
        let bounds = redeem.bounds();
        if !bounds.cost.is_consensus_valid() {
            return Err(JsError::new(&format!("bounds exceeded: {}", bounds.cost)));
        }
        let (program_bytes, witness_bytes) = redeem.encode_to_vec();
        let mut final_script_witness = vec![
           witness_bytes, program_bytes, script_bytes, control_bytes
        ];
        // Add padding to the script witness if budget is exceeded
        if let Some(padding_bytes) = bounds.cost.get_padding(&final_script_witness) {
            // Annex has to be removed from the stack
            // https://github.com/ElementsProject/elements/blob/9748c00c3344b815d75c4b5c251b341fb34fa80f/src/script/interpreter.cpp#L3275
            final_script_witness.push(padding_bytes);
        } else {
            //println!("No padding needed");
        }
        if !bounds.cost.is_budget_valid(&final_script_witness) {
            return Err(JsError::new(&format!("budget exceeded: {}", bounds.cost)));
        }
        Ok(final_script_witness)
    }
    fn script_to_transaction (
        previous_output: OutPoint,
        destination:     Address,
        value:           u64,
        fee:             u64,
    ) -> Maybe<PartiallySignedTransaction> {
        let asset = hex::decode(ASSET)
            .map_err(|e|JsError::new(&format!("failed to decode asset: {e}")))?;
        let asset = AssetId::from_slice(&asset)
            .map_err(|e|JsError::new(&format!("failed to decode asset: {e}")))?;
        let in_0 = TxIn {
            previous_output,
            is_pegin:       false,
            script_sig:     Script::new(),
            sequence:       Sequence::MAX,
            asset_issuance: AssetIssuance::null(),
            witness:        TxInWitness::empty(),
        };
        let out_0 = TxOut {
            value:         TxValue::Explicit(value - fee),
            script_pubkey: destination.script_pubkey(),
            asset:         Asset::Explicit(asset.clone()),
            nonce:         Nonce::Null,
            witness:       TxOutWitness::default(),
        };
        let out_1 = TxOut::new_fee(fee, asset);
        Ok(PartiallySignedTransaction::from_tx(Transaction {
            version:   2,
            lock_time: LockTime::ZERO.into(),
            input:     vec![in_0],
            output:    vec![out_0, out_1], 
        }))
    }
    fn control_bytes (&self) -> Maybe<Vec<u8>> {
        let tap = script_to_taproot(self.script.clone())?;
        let ver = LeafVersion::from_u8(0xbe)
            .map_err(|e|JsError::new(&format!("leaf version mismatch: {e}")))?;
        let block = tap.control_block(&(self.script.clone(), ver))
            .ok_or_else(||JsError::new("matching control block not found"))?;
        let bytes = block.serialize();
        // (control[0] & TAPROOT_LEAF_MASK) == TAPROOT_LEAF_TAPSIMPLICITY)
        assert_eq!(bytes[0] & 0xfe, 0xbe);
        Ok(bytes)
    }
}

fn parse_bool (x: JsValue) -> bool {
    x.is_truthy()
}

fn parse_addr (x: JsValue) -> Maybe<Address> {
    let address = required!("addr: not string": x.as_string())?;
    let address = expected!("addr: not parsed": Address::from_str(&address))?;
    Ok(address)
}

fn parse_tx_id (x: JsValue) -> Maybe<Txid> {
    let txid = required!("txid: not string": x.as_string())?;
    let txid = expected!("txid: not parsed": Txid::from_str(&txid))?;
    Ok(txid)
}

fn parse_tx_bytes (bytes: JsValue) -> Maybe<Transaction> {
    let bytes = required!("tx bytes: not string": bytes.as_string())?;
    let bytes = expected!("tx bytes: not base16": hex::decode(bytes.trim()))?;
    let tx    = expected!("tx bytes: not parsed": deserialize_tx(&bytes))?;
    Ok(tx)
}

fn parse_args (args: JsValue) -> Maybe<Arguments> {
    if args.is_truthy() {
        if !args.is_object() {
            return Err(JsError::new("args: must be object"))
        }
        if let Some(s) = JSON::stringify(&args)
            .map_err(|e|JsError::new(&format!("failed to stringify args: {e:?}")))?
            .as_string()
        {
            return Ok(serde_json::from_str(&s)?);
        }
    }
    Ok(Arguments::default())
}

fn parse_wits (wits: JsValue) -> Maybe<WitnessValues> {
    if wits.is_truthy() {
        if !wits.is_object() {
            return Err(JsError::new("wits: must be object"))
        }
        if let Some(s) = JSON::stringify(&wits)
            .map_err(|e|JsError::new(&format!("failed to stringify wits: {e:?}")))?
            .as_string()
        {
            return Ok(serde_json::from_str(&s)?);
        }
    }
    Ok(WitnessValues::default())
}

fn tx_ins_to_js_value (x: &[TxIn]) -> Maybe<JsValue> {
    let results = Array::new();
    Ok(results.into())
}

fn tx_outs_to_js_value (x: &[TxOut]) -> Maybe<JsValue> {
    let results = Array::new();
    Ok(results.into())
}

/// Magic
pub(crate) const UNSPENDABLE: &str =
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";
/// More magic
pub(crate) const ASSET: &str =
    "499a818545f6bae39fc03b637f2a4e1e64e590cac1bc3a6f6d71aa4443654c14";

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

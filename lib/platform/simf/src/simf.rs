use crate::*;
/// [ElementsEnv] for satisfying some Simplicity programs.
pub type Env = simplicityhl::simplicity::jet::elements::ElementsEnv<Arc<Transaction>>;
/// Create SimplicityHL P2TR address from a [Cmr]
/// (Commitment Merkle root), such as that of a
/// compiled Simplicity program.
#[wasm_bindgen]
pub fn cmr_to_p2tr (cmr: JsValue) -> Maybe<JsString> {
    console_error_panic_hook::set_once();
    Ok(format!("{}", script_to_p2tr(Script::from(Input::bytes(cmr)?))?).into())
}
/// Compile a SimplicityHL program.
#[wasm_bindgen] pub fn compile (source: JsString, options: Object) -> Maybe<Program> {
    console_error_panic_hook::set_once();
    let source = source.as_string().unwrap_or_default();
    let mut debug = false;
    let mut prune = false;
    let mut args  = Arguments::default();
    if options.is_object() {
        debug = get!(options, "debug", Input::flag);
        prune = get!(options, "prune", Input::flag);
        args  = get!(options, "args",  Input::args)?;
    }
    Program::new(&source, args, debug, prune)
}
/// A valid compiled SimplicityHL program.
#[wasm_bindgen(inspectable)] pub struct Program {
    pub(crate) args:     Arguments,
    pub(crate) commit:   Arc<CommitNode<Elements>>,
    pub(crate) compiled: CompiledProgram,
    pub(crate) debug:    bool,
    pub(crate) p2tr:     Address,
    pub(crate) prune:    bool,
    pub(crate) script:   Script,
    pub(crate) source:   Arc<str>,
}
impl Program {
    /// Internal constructor.
    fn new (source: &str, args: Arguments, debug: bool, prune: bool) -> Maybe<Self> {
        let compiled = CompiledProgram::new(source, args.clone(), debug);
        let compiled = expected!("compile failed": compiled)?;
        let commit   = compiled.commit();
        let script   = Script::from(commit.cmr().to_byte_array().to_vec());
        let source   = source.into();
        let p2tr     = taproot_to_p2tr(&script_to_taproot(script.clone())?);
        Ok(Self { source, p2tr, debug, prune, args, compiled, commit, script, })
    }
}
#[wasm_bindgen] impl Program {
    /// Generate a spend transaction.
    ///
    /// Requires input transaction to program's P2TR address.
    #[wasm_bindgen] pub fn spend (&self, options: Object) -> Maybe<Object> {
        asserted!(options.is_object());
        let input = get!(options, "tx", Input::tx)?;
        let (tx, asset, balance) = self.tx(&options, &input)?;
        let witness = get!(options, "witness", Input::witness)?;
        let spend = self.finalize(tx, asset, balance, witness)?;
        let bytes = spend.serialize();
        //let json = expected!("convert to json": JSON::parse(&serde_json::to_string(&tx)?))?;
        Ok(obj! {
            "bytes"  = Output::u8a(&bytes),
            "hex"    = hex::encode(&bytes),
            "txs_info" = obj! {
                "input" = format!("{input:?}"),
                "spend" = format!("{spend:?}"),
            },
        })
    }
    fn tx (&self, options: &JsValue, input: &Transaction) -> Maybe<(Transaction, AssetId, u64)> {
        let input = get!(options, "tx", Input::tx)?;
        let (input, asset_id, balance) = self.tx_ins(&input)?;
        let output = self.tx_outs(&options, asset_id, balance)?;
        let tx = Transaction { version: 2, lock_time: LockTime::ZERO, input, output };
        Ok((tx, asset_id, balance))
    }
    fn tx_ins (&self, input: &Transaction) -> Maybe<(Vec<TxIn>, AssetId, u64)> {
        let (previous, utxo) = find_utxo(input, &self.p2tr)?;
        let asset_id = required!("utxo: asset cloaked": utxo.asset.explicit())?;
        let balance  = required!("utxo: value cloaked": utxo.value.explicit())?;
        Ok((tx_script_ins(previous), asset_id, balance))
    }
    fn tx_outs (&self, options: &JsValue, asset_id: AssetId, balance: u64) -> Maybe<Vec<TxOut>> {
        let to    = get!(options, "to",    Input::address)?;
        let value = get!(options, "value", Input::sats)?;
        let fee   = get!(options, "fee",   Input::sats)?;
        tx_script_outs(asset_id, &self.p2tr, balance, to, value, fee)
    }
    fn satisfy (&self, asset_id: AssetId, balance: u64, witness: WitnessValues) -> Maybe<SatisfiedProgram> {
        let env = self.tx_env(asset_id, balance)?;
        expected!("satisfy": self.compiled.satisfy_with_env(witness, Some(&env)))
    }
    fn finalize (&self, tx: Transaction, asset_id: AssetId, balance: u64, witness: WitnessValues) -> Maybe<Transaction> {
        let script  = self.script.clone().into_bytes();
        let program = self.satisfy(asset_id, balance, witness)?;
        tx_finalize(tx, final_script_witness(self.control()?, script, program)?)
    }
    fn control (&self) -> Maybe<Vec<u8>> {
        script_control_block(&self.script)
        // FIXME? take control block from matching tap_scripts of input:
        //for (cb, script_ver) in &input.tap_scripts {
            //if script_ver.1 == leaf_version() && &script_ver.0[..] == cmr.as_ref() {
                //control_block_leaf = Some((cb.clone(), script_ver.0.clone()));
            //}
        //}
        // FIXME? why was this control block hardcoded in simply?
        //let ctrl = expected!("env: control block fail": ControlBlock::from_slice(&[
            //0xc0, 0xeb, 0x04, 0xb6, 0x8e, 0x9a, 0x26, 0xd1,
            //0x16, 0x04, 0x6c, 0x76, 0xe8, 0xff, 0x47, 0x33,
            //0x2f, 0xb7, 0x1d, 0xda, 0x90, 0xff, 0x4b, 0xef,
            //0x53, 0x70, 0xf2, 0x52, 0x26, 0xd3, 0xbc, 0x09, 0xfc
        //]))?;
    }
    fn tx_env (&self, asset_id: AssetId, value: u64) -> Maybe<Env> {
        let version = 2;
        let lock_time = LockTime::ZERO;
        let tx = Arc::new(Transaction { version, lock_time, input: vec![], output: vec![] });
        // FIXME: take from pset inputs:
        let inputs = vec![ElementsUtxo {
            script_pubkey: self.script.clone(),
            asset: Asset::Explicit(asset_id),
            value: TxValue::Explicit(value),
        }];
        //let input_utxos = pset
            //.inputs()
            //.iter()
            //.enumerate()
            //.map(|(n, input)| match input.witness_utxo {
              //Some(ref utxo) => Ok(ElementsUtxo {
                //script_pubkey: utxo.script_pubkey.clone(),
                //asset: utxo.asset,
                //value: utxo.value,
              //}),
              //None => Err(PsetError::MissingWitnessUtxo(n)),
            //})
            //.collect::<Result<Vec<_>, _>>()?;
        let ctrl = ControlBlock::from_slice(&self.control()?)?;
        let cmr  = self.compiled.commit().cmr();
        let hash = BlockHash::from_str( // FIXME: allow non-elementsregtest
            "0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206"
        )?;
        Ok(ElementsEnv::new(tx, inputs, 0, cmr, ctrl, None, hash))
        //let tx = Arc::new(pset.extract_tx().map_err(PsetError::PsetExtract)?);
        //let ins = pset.inputs().iter().enumerate().map(|(n, input)| match input.witness_utxo {
            //Some(ref utxo) => Ok(ElementsUtxo {
                //script_pubkey: utxo.script_pubkey.clone(),
                //asset: utxo.asset,
                //value: utxo.value,
            //}),
            //None => Err(PsetError::MissingWitnessUtxo(n)),
        //}).collect::<Result<Vec<_>, _>>()?
        //Ok(ElementsEnv::new(
            //tx,
            //ins,
            //input,
            //cmr,
            //control_block.clone(),
            //None,
            //match genesis_hash {
                //Some(s) => s.parse().map_err(PsetError::GenesisHashParse)?,
                //None => elements::BlockHash::from_byte_array([
                    //// copied out of simplicity-webide source
                    //0xc1, 0xb1, 0x6a, 0xe2, 0x4f, 0x24, 0x23, 0xae,
                    //0xa2, 0xea, 0x34, 0x55, 0x22, 0x92, 0x79, 0x3b,
                    //0x5b, 0x5e, 0x82, 0x99, 0x9a, 0x1e, 0xed, 0x81,
                    //0xd5, 0x6a, 0xee, 0x52, 0x8e, 0xda, 0x71, 0xa7,
                //]),
            //},
        //))
    }
    /// Use this in JS to get the properties of the compiled program.
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json (&self) -> Object {
        Output::program(&self).unwrap_or_else(|e|JsValue::from(e).into())
    }
    /// Programs stringify to their P2TR addresses.
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string (&self) -> String {
        format!("{}", &self.p2tr)
    }
}

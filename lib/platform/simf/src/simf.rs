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
        let asset_id = get!(options, "asset",   Input::asset_id)?;
        let deployed = get!(options, "tx",      Input::tx_bytes)?;
        let witness  = get!(options, "witness", Input::witness)?;
        let (inputs, balance) = self.input(&deployed)?;
        let outputs  = self.output(&options, asset_id, balance)?;
        let tx       = self.finalize(asset_id, inputs, outputs, witness)?;
        let bytes    = tx.serialize();
        log!("{tx:?}");
        Ok(obj! {
            "decoded" = Output::tx(&tx)?,
            "bytes"   = Output::u8a(&bytes),
            "hex"     = hex::encode(&bytes),
        })
    }
    fn input (&self, deployed: &Transaction) -> Maybe<(Vec<TxIn>, u64)> {
        let (previous, utxo) = find_utxo(deployed, &self.p2tr)?;
        Ok((tx_script_ins(previous), required!("utxo cloaked": utxo.value.explicit())?))
    }
    fn output (&self, options: &JsValue, asset_id: AssetId, balance: u64) -> Maybe<Vec<TxOut>> {
        let to    = get!(options, "to",    Input::address)?;
        let value = get!(options, "value", Input::sats)?;
        let fee   = get!(options, "fee",   Input::sats)?;
        tx_script_outs(asset_id, &self.p2tr, balance, to, value, fee)
    }
    fn satisfy (&self, asset_id: AssetId, witness: WitnessValues) -> Maybe<SatisfiedProgram> {
        let asset = Asset::Explicit(asset_id);
        expected!("satisfy": self.compiled.satisfy_with_env(witness, Some(&make_env(asset)?)))
    }
    fn finalize (
        &self, asset_id: AssetId, inputs: Vec<TxIn>, outputs: Vec<TxOut>, witness: WitnessValues
    ) -> Maybe<Transaction> {
        let control = script_control_block(&self.script)?;
        let script  = self.script.clone().into_bytes();
        let program = self.satisfy(asset_id, witness)?;
        tx_finalize(transaction(inputs, outputs), final_script_witness(control, script, program)?)
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

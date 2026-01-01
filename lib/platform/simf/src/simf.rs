use crate::*;

/// [ElementsEnv] for satisfying some Simplicity programs.
pub type Env = simplicityhl::simplicity::jet::elements::ElementsEnv<Arc<Transaction>>;

/// Create a SimplicityHL P2TR address from the [Cmr]
/// (Commitment Merkle root) of a compiled Simplicity program.
#[wasm_bindgen]
pub fn cmr_to_p2tr (cmr: JsValue) -> Maybe<JsString> {
    console_error_panic_hook::set_once();
    let tap = script_to_taproot(Script::from(bytes_to_vec(cmr)?))?;
    Ok(format!("{}", taproot_to_p2tr(&tap)).into())
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
    /// Programs have many properties, so we default to
    /// just stringifying them to the original source.
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string (&self) -> String {
        self.source.to_string()
    }
    /// Use this in JS to get the properties of the compiled program.
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json (&self) -> Object {
        Output::program(&self).unwrap_or_else(|e|JsValue::from(e).into())
    }
    /// Generate a spend transaction.
    ///
    /// Requires input transaction to program's P2TR address.
    #[wasm_bindgen] pub fn spend (&self, options: Object) -> Maybe<Object> {
        console_error_panic_hook::set_once();
        // Parse options
        if !options.is_object() { return err!("options: not object") }
        let tx_id:       Txid          = get!(options, "txId",        Input::tx_id)?;
        let tx_bytes:    Transaction   = get!(options, "txBytes",     Input::tx_bytes)?;
        let witness:     WitnessValues = get!(options, "witness",     Input::wits)?;
        let destination: Address       = get!(options, "destination", Input::addr)?;
        let asset:       AssetId       = get!(options, "asset",       Input::asset_id)?;
        let fee:         u64           = get!(options, "fee",         Input::fee)?;
        let env:         Env           = make_env(Asset::Explicit(asset))?;
        // Find matching output in input transaction
        let (previous, utxo) = find_utxo(tx_id, &tx_bytes, &self.p2tr)?;
        let value     = required!("value not explicit": utxo.value.explicit())?;
        let control   = script_control_block(&self.script)?;
        let script    = self.script.clone().into_bytes();
        let satisfied = expected!("satisfy": self.compiled.satisfy_with_env(witness, Some(&env)))?;
        let wits      = final_script_witness(control, script, satisfied)?;
        // Return output transaction data to broadcast
        let tx = tx_script(asset, previous, destination, value, fee)?;
        let tx = tx_finalize(tx, wits)?;
        let bytes = tx.serialize();
        Ok(obj! {
            "decoded" = Output::tx(&tx)?,
            "bytes"   = Output::u8a(&bytes),
            "hex"     = hex::encode(&bytes),
        })
    }
}

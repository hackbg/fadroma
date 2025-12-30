use crate::*;

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
        debug = get!(options, "debug", Parse::flag);
        prune = get!(options, "prune", Parse::flag);
        args  = get!(options, "args",  Parse::args)?;
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
    ///
    /// Requires input transaction to program's P2TR address.
    #[wasm_bindgen] pub fn spend (&self, options: Object) -> Maybe<Object> {
        console_error_panic_hook::set_once();
        // Parse options
        if !options.is_object() { return err!("options: not object") }
        let tx_id:       Txid          = get!(options, "txId",        Parse::tx_id)?;
        let tx_bytes:    Transaction   = get!(options, "txBytes",     Parse::tx_bytes)?;
        let witness:     WitnessValues = get!(options, "witness",     Parse::wits)?;
        let destination: Address       = get!(options, "destination", Parse::addr)?;
        let asset:       AssetId       = get!(options, "asset",       Parse::asset_id)?;
        let fee:         u64           = get!(options, "fee",         Parse::fee)?;
        let env:         Env           = make_env(Asset::Explicit(asset))?;
        // Find matching output in input transaction
        let (previous, utxo) = find_utxo(tx_id, &tx_bytes, &self.p2tr)?;
        let value     = required!("value not explicit": utxo.value.explicit())?;
        let control   = script_control_block(&self.script)?;
        let script    = self.script.clone().into_bytes();
        let satisfied = expected!("satisfy": self.compiled.satisfy_with_env(witness, Some(&env)))?;
        let wits      = final_script_witness(control, script, satisfied)?;
        let tx        = tx_script(asset, previous, destination, value, fee)?;
        let tx        = tx_finalize(tx, wits)?;
        // Return output transaction data to broadcast
        Ok(obj! {
            "input"     = tx_ins_to_js_value(&tx.input)?,
            "output"    = tx_outs_to_js_value(&tx.output)?,
            "version"   = tx.version,
            "lock_time" = match tx.lock_time {
                LockTime::Blocks(height) => obj!("block" = height.to_consensus_u32()),
                LockTime::Seconds(time)  => obj!("seconds" = time.to_consensus_u32()),
            },
        })
    }
}

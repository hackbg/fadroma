use crate::*;

pub struct Input;

impl Input {
    pub fn sats (input: JsValue) -> Maybe<u64> {
        if BigInt::is_type_of(&input) {
            expected!("bigint->u64": u64::try_from(input))
        } else if Number::is_type_of(&input) {
            warn!("number->u64: *10^8, use bigint to avoid precision issues");
            expected!("number->u64": f64::try_from(input).map(|x|(x * 100000000.0) as u64))
        } else if JsString::is_type_of(&input) {
            warn!("string->u64: use bigint to avoid typing issues");
            expected!("string->u64": u64::try_from(input))
        } else {
            return err!("received {:?}: need integer", input.js_typeof())
        }
    }

    pub fn flag (x: JsValue) -> bool {
        x.is_truthy()
    }

    /// Accepts either [Uint8Array] or hex string.
    pub fn bytes (input: JsValue) -> Maybe<Vec<u8>> {
        if Uint8Array::instanceof(&input) { 
            Ok(Uint8Array::unchecked_from_js(input).to_vec())
        } else if JsString::is_type_of(&input) {
            expected!("decode input": hex::decode(&required!(input.as_string())?))
        } else {
            return err!("need Uint8Array or hex string")
        }
    }

    pub fn address (x: JsValue) -> Maybe<Address> {
        let address = required!("addr: not string": x.as_string())?;
        let address = expected!("addr: not parsed": Address::from_str(&address))?;
        Ok(address)
    }

    pub fn tx (bytes: JsValue) -> Maybe<Transaction> {
        let bytes = required!("tx bytes: not string": bytes.as_string())?;
        let bytes = expected!("tx bytes: not base16": hex::decode(bytes.trim()))?;
        let tx    = expected!("tx bytes: not parsed": deserialize_tx(&bytes))?;
        Ok(tx)
    }

    pub fn args (args: JsValue) -> Maybe<Arguments> {
        if args.is_truthy() {
            if !args.is_object() {
                return err!("args: must be object")
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

    pub fn witness (wits: JsValue) -> Maybe<WitnessValues> {
        if wits.is_truthy() {
            if !wits.is_object() { return err!("wits: must be object") }
            let wits = expected!("wits: failed to stringify": JSON::stringify(&wits))?;
            if let Some(s) = wits.as_string() { return Ok(serde_json::from_str(&s)?); }
        }
        Ok(WitnessValues::default())
    }
}

pub struct Output;

impl Output {
    pub fn vex_to_hex (vex: &[Vec<u8>]) -> String {
        hex::encode(&vex.iter().flat_map(|x|x.iter()).cloned().collect::<Vec<_>>())
    }

    pub fn opt_to_str <D: std::fmt::Display> (opt: &Option<D>) -> Option<String> {
        opt.as_ref().map(|x|format!("{x}"))
    }

    pub fn program (program: &Program) -> Maybe<Object> {
        Ok(obj! {
            "source" = program.source.to_string(),
            "debug"  = program.debug,
            "prune"  = program.prune,
            "args"   = serde_json::to_string(&program.args)?,
            "cmr"    = hex::encode(program.commit.cmr().to_byte_array()),
            "ihr"    = program.commit.ihr().map(|ihr|hex::encode(ihr.to_byte_array())),
            "amr"    = program.commit.amr().map(|ihr|hex::encode(ihr.to_byte_array())),
            "p2tr"   = program.p2tr.to_string(),
        })
    }

    pub fn u8a (bytes: &[u8]) -> Uint8Array {
        let u8a = Uint8Array::new_with_length(bytes.len() as u32);
        u8a.copy_from(bytes);
        u8a
    }
}

use crate::*;

pub struct Input;

impl Input {
    // FIXME
    pub fn fee (_: JsValue) -> Maybe<u64> {
        Ok(1000)
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

    pub fn asset_id (x: JsValue) -> Maybe<AssetId> {
        if x.is_truthy() {
            let asset = required!("asset: not string": x.as_string())?;
            let asset = expected!("asset: default asset":  hex::decode(asset))?;
            expected!("invalid asset": AssetId::from_slice(&asset))
        } else {
            let asset = expected!("decode default asset":  hex::decode(
                // testnet liquid btc
                "499a818545f6bae39fc03b637f2a4e1e64e590cac1bc3a6f6d71aa4443654c14"
            ))?;
            expected!("invalid default asset": AssetId::from_slice(&asset))
        }
    }

    pub fn address (x: JsValue) -> Maybe<Address> {
        let address = required!("addr: not string": x.as_string())?;
        let address = expected!("addr: not parsed": Address::from_str(&address))?;
        Ok(address)
    }

    pub fn tx_id (x: JsValue) -> Maybe<Txid> {
        let txid = required!("txid: not string": x.as_string())?;
        let txid = expected!("txid: not parsed": Txid::from_str(&txid))?;
        Ok(txid)
    }

    pub fn tx_bytes (bytes: JsValue) -> Maybe<Transaction> {
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

    pub fn tx (tx: &Transaction) -> Maybe<Object> {
        Ok(obj! {
            "version"   = tx.version,
            "input"     = Self::tx_ins_to_obj(&tx.input)?,
            "output"    = Self::tx_outs_to_obj(&tx.output)?,
            "lock_time" = match tx.lock_time {
                LockTime::Blocks(height) => obj!("block" = height.to_consensus_u32()),
                LockTime::Seconds(time)  => obj!("seconds" = time.to_consensus_u32()),
            },
        })
    }

    pub fn u8a (bytes: &[u8]) -> Uint8Array {
        let u8a = Uint8Array::new_with_length(bytes.len() as u32);
        u8a.copy_from(bytes);
        u8a
    }

    pub fn tx_ins_to_obj (tx_ins: &[TxIn]) -> Maybe<JsValue> {
        let results = Array::new();
        for tx_in in tx_ins.iter() {
            results.push(&Self::tx_in_to_obj(tx_in)?.into());
        }
        Ok(results.into())
    }

    pub fn tx_outs_to_obj (tx_outs: &[TxOut]) -> Maybe<Object> {
        let results = Array::new();
        for tx_out in tx_outs.iter() {
            results.push(&Self::tx_out_to_obj(tx_out)?.into());
        }
        Ok(results.into())
    }

    pub fn tx_in_to_obj (tx_in: &TxIn) -> Maybe<Object> {
        Ok(obj! {
            "previous_output" = obj! {
                "txid" = format!("{}", tx_in.previous_output.txid),
                "vout" = tx_in.previous_output.vout,
            },
            "is_pegin"        = format!("{}", tx_in.is_pegin),
            "script_sig"      = format!("{}", tx_in.script_sig),
            "sequence"        = format!("{}", tx_in.sequence),
            "asset_issuance"  = obj! {
                "asset_blinding_nonce" = format!("{}", tx_in.asset_issuance.asset_blinding_nonce),
                "asset_entropy"        = hex::encode(&tx_in.asset_issuance.asset_entropy),
                "amount"               = format!("{}", tx_in.asset_issuance.amount),
                "inflation_keys"       = format!("{}", tx_in.asset_issuance.inflation_keys),
            },
            "witness"         = obj! {
                "amount_rangeproof"         = Self::opt_to_str(&tx_in.witness.amount_rangeproof),
                "inflation_keys_rangeproof" = Self::opt_to_str(&tx_in.witness.inflation_keys_rangeproof),
                "script_witness"            = Self::vex_to_hex(&tx_in.witness.script_witness),
                "pegin_witness"             = Self::vex_to_hex(&tx_in.witness.pegin_witness),
            },
        })
    }

    pub fn tx_out_to_obj (tx_out: &TxOut) -> Maybe<Object> {
        Ok(obj! {
            "value"         = format!("{}", tx_out.value),
            "script_pubkey" = format!("{}", tx_out.script_pubkey),
            "asset"         = format!("{}", tx_out.asset),
            "nonce"         = format!("{}", tx_out.nonce),
            "witness"       = obj! {
                "surjection_proof" = Self::opt_to_str(&tx_out.witness.surjection_proof),
                "rangeproof"       = Self::opt_to_str(&tx_out.witness.rangeproof),
            },
        })
    }
}

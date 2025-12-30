use crate::*;

pub struct Parse;

impl Parse {
    pub fn flag (x: JsValue) -> bool {
        x.is_truthy()
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

    // FIXME
    pub fn fee (_: JsValue) -> Maybe<u64> {
        Ok(1000)
    }

    //pub fn asset (x: JsValue) -> Maybe<Asset> {
        //let asset = required!("asset: not string": x.as_string())?;
        //let asset = expected!("asset: not parsed": Asset::from_str(&asset))?;
        //asset
    //}

    pub fn addr (x: JsValue) -> Maybe<Address> {
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

    pub fn wits (wits: JsValue) -> Maybe<WitnessValues> {
        if wits.is_truthy() {
            if !wits.is_object() { return err!("wits: must be object") }
            let wits = expected!("wits: failed to stringify": JSON::stringify(&wits))?;
            if let Some(s) = wits.as_string() { return Ok(serde_json::from_str(&s)?); }
        }
        Ok(WitnessValues::default())
    }
}


use crate::*;

pub fn tx_sections (tx: &Tx) -> Result<Array, Error> {
    let sections = Array::new();
    for section in tx.sections.iter() {
        sections.push(&JsValue::from(tx_section(&section)?));
    }
    Ok(sections)
}

pub fn tx_section (section: &Section) -> Result<Object, Error> {
    match section {
        Section::Data(data) => section_data(data),
        Section::ExtraData(code) => section_extra_data(code),
        Section::Code(code) => section_code(code),
        Section::Authorization(authorization) => section_authorization(authorization),
        Section::MaspBuilder(masp_builder) => section_masp_builder(masp_builder),
        Section::Header(header) => section_header(header),
        // FIXME: Can't name the Transaction type to factor out
        // the following code into a separate function:
        Section::MaspTx(transaction) =>
            object(&[
                ("type".into(),
                    "MaspTx".into()),
                ("txid".into(),
                    format!("{}", transaction.txid()).into()),
                //("version".into(),
                    //match transaction.version() {
                        //TxVersion::MASPv5 => "MASPv5"
                    //}.into()),
                //("consensusBranchId".into(),
                    //match transaction.consensus_branch_id() {
                        //BranchID::MASP => "MASP"
                    //}.into()),
                ("lockTime".into(),
                    transaction.lock_time().into()),
                ("expiryHeight".into(),
                    format!("{}", transaction.expiry_height()).into()),
                ("transparentBundle".into(),
                    if let Some(bundle_data) = transaction.transparent_bundle() {
                        let vin = Array::new();
                        for tx_data in bundle_data.vin.iter() {
                            vin.push(&object(&[
                                ("assetType".into(),
                                    format!("{}", tx_data.asset_type).into()),
                                ("value".into(),
                                    JsValue::from(BigInt::from(tx_data.value))),
                                ("address".into(),
                                    hex::encode_upper(tx_data.address.0).into()),
                            ])?.into());
                        }
                        let vout = Array::new();
                        for tx_data in bundle_data.vout.iter() {
                            vout.push(&object(&[
                                ("assetType".into(),
                                    format!("{}", tx_data.asset_type).into()),
                                ("value".into(),
                                    JsValue::from(BigInt::from(tx_data.value))),
                                ("address".into(),
                                    hex::encode_upper(tx_data.address.0).into()),
                            ])?.into());
                        }
                        object(&[
                            ("vin".into(),  vin.into()),
                            ("vout".into(), vout.into()),
                        ])?.into()
                    } else {
                        JsValue::NULL
                    }),
                ("saplingBundle".into(),
                    if let Some(bundle_data) = transaction.sapling_bundle() {
                        let shielded_spends = Array::new();
                        for spend in bundle_data.shielded_spends.iter() {
                            shielded_spends.push(&object(&[
                                ("cv".into(),
                                    format!("{}", &spend.cv).into()),
                                ("anchor".into(),
                                    hex::encode_upper(&spend.anchor.to_bytes()).into()),
                                ("nullifier".into(),
                                    hex::encode_upper(&spend.nullifier).into()),
                                ("rk".into(),
                                    format!("{}", &spend.rk.0).into()),
                                ("zkProof".into(),
                                    hex::encode_upper(&spend.zkproof).into()),
                                //("spendAuthSig".into(), to_hex(&spend.spend_auth_sig).into()),
                            ])?.into());
                        }
                        let shielded_converts = Array::new();
                        for convert in bundle_data.shielded_converts.iter() {
                            shielded_converts.push(&object(&[
                                ("cv".into(),
                                    format!("{}", &convert.cv).into()),
                                ("anchor".into(),
                                    hex::encode_upper(&convert.anchor.to_bytes()).into()),
                                ("zkProof".into(),
                                    hex::encode_upper(&convert.zkproof).into()),
                            ])?.into());
                        }
                        let shielded_outputs = Array::new();
                        for output in bundle_data.shielded_outputs.iter() {
                            shielded_outputs.push(&object(&[
                                ("cv".into(),
                                    format!("{}", &output.cv).into()),
                                ("cmu".into(),
                                    hex::encode_upper(&output.cmu.to_bytes()).into()),
                                ("ephemeralKey".into(),
                                    hex::encode_upper(&output.ephemeral_key.0).into()),
                                ("encCiphertext".into(),
                                    hex::encode_upper(&output.enc_ciphertext).into()),
                                ("outCiphertext".into(),
                                    hex::encode_upper(&output.out_ciphertext).into()),
                                ("zkProof".into(),
                                    hex::encode_upper(&output.zkproof).into()),
                            ])?.into());
                        }
                        let value_balance = Object::new();
                        for (asset_type, value) in bundle_data.value_balance.components() {
                            Reflect::set(
                                &value_balance,
                                &hex::encode_upper(asset_type.get_identifier()).into(),
                                &BigInt::from(*value).into()
                            )?;
                        }
                        object(&[
                            ("shieldedSpends".into(),   shielded_spends.into()),
                            ("shieldedConverts".into(), shielded_converts.into()),
                            ("shieldedOutputs".into(),  shielded_outputs.into()),
                            ("valueBalance".into(),     value_balance.into()),
                        ])?.into()
                    } else {
                        JsValue::NULL
                    }),
            ]),
    }
}

fn section_data (data: &Data) -> Result<Object, Error> {
    object(&[
        ("type".into(), "Data".into()),
        ("salt".into(), hex::encode_upper(&data.salt).into()),
        ("data".into(), hex::encode_upper(&data.data).into()),
    ])
}

fn section_extra_data (code: &Code) -> Result<Object, Error> {
    object(&[
        ("type".into(), "ExtraData".into()),
        ("salt".into(), hex::encode_upper(&code.salt).into()),
        ("code".into(), hex::encode_upper(&code.code.hash().0).into()),
        ("tag".into(),  if let Some(ref tag) = code.tag {
            tag.into()
        } else {
            JsValue::NULL
        }),
    ])
}

fn section_code (code: &Code) -> Result<Object, Error> {
    object(&[
        ("type".into(), "Code".into()),
        ("salt".into(), hex::encode_upper(&code.salt).into()),
        ("code".into(), hex::encode_upper(&code.code.hash().0).into()),
        ("tag".into(),  if let Some(ref tag) = code.tag {
            tag.into()
        } else {
            JsValue::NULL
        }),
    ])
}

fn section_authorization (authorization: &Authorization) -> Result<Object, Error> {
    object(&[
        ("type".into(), "Signature".into()),
        ("targets".into(), {
            let targets = Array::new();
            for target in authorization.targets.iter() {
                targets.push(&hex::encode_upper(target.0).into());
            }
            targets
        }.into()),
        ("signer".into(), match &authorization.signer {
            Signer::Address(address) => {
                address.encode().into()
            },
            Signer::PubKeys(pubkeys) => {
                let output = Array::new();
                for pubkey in pubkeys.iter() {
                    output.push(&format!("{pubkey}").into());
                }
                output.into()
            },
        }),
        ("signatures".into(), {
            let output = Object::new();
            for (key, value) in authorization.signatures.iter() {
                Reflect::set(&output, &format!("{key}").into(), &format!("{value}").into())?;
            }
            output
        }.into()),
    ])
}

fn section_masp_builder (masp_builder: &MaspBuilder) -> Result<Object, Error> {
    object(&[
        ("type".into(),
            "MaspBuilder".into()),
        ("target".into(),
            format!("{:?}", masp_builder.target).into()),
        ("asset_types".into(), {
            let types = Set::new(&JsValue::UNDEFINED);
            for asset_type in masp_builder.asset_types.iter() {
                let asset = object(&[
                    ("token".into(),    asset_type.token.encode().into()),
                    ("denom".into(),    asset_type.denom.0.into()),
                    ("position".into(), match asset_type.position {
                        MaspDigitPos::Zero  => 0u8,
                        MaspDigitPos::One   => 1u8,
                        MaspDigitPos::Two   => 2u8,
                        MaspDigitPos::Three => 3u8,
                    }.into()),
                    ("epoch".into(), if let Some(epoch) = asset_type.epoch {
                        format!("{epoch}").into()
                    } else {
                        JsValue::UNDEFINED
                    }),
                ])?;
                types.add(&asset.into());
            }
            types
        }.into()),
        //("metadata".into(),    masp_builder.metadata.into()),
        //("builder".into(),     masp_builder.builder.into()),
    ])
}

fn section_header (header: &TxHeader) -> Result<Object, Error> {
    let batch = Array::new();
    for commitment in header.batch.iter() {
        batch.push(&JsValue::from(object(&[
            ("hash".into(),     commitment.get_hash().raw().into()),
            ("codeHash".into(), commitment.code_sechash().raw().into()),
            ("dataHash".into(), commitment.data_sechash().raw().into()),
            ("memoHash".into(), commitment.memo_sechash().raw().into()),
        ])?));
    }
    object(&[
        ("type".into(),       "Header".into()),
        ("chain_id".into(),   header.chain_id.as_str().into()),
        ("expiration".into(), header.expiration.map(|t|t.to_rfc3339()).into()),
        ("timestamp".into(),  header.timestamp.to_rfc3339().into()),
        ("atomic".into(),     header.atomic.into()),
        ("batch".into(),      batch.into()),
        ("txType".into(),     match header.tx_type {
            TxType::Raw          => "Raw",
            TxType::Wrapper(_)   => "Wrapper",
            //TxType::Decrypted(_) => "Decrypted",
            TxType::Protocol(_)  => "Protocol",
        }.into()),
    ])
}


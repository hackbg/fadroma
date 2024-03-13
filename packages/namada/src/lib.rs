extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect, BigInt, Set};

//use masp_primitives::consensus::BranchId;
//use masp_primitives::transaction::Transaction;
//use masp_primitives::transaction::TxVersion;
use namada::address::Address;
use namada::core::borsh::BorshDeserialize;
//use namada::core::masp_primitives::TxVersion;
//use namada::governance::parameters::GovernanceParameters;
use namada::storage::KeySeg;
use namada::string_encoding::Format;
use namada::tx::data::TxType;
use namada::tx::{Tx, Section, Signer};
use namada::token::MaspDigitPos;
use std::fmt::Write;
use std::io::Cursor;

#[wasm_bindgen]
pub struct Decode;

#[wasm_bindgen]
impl Decode {

    #[wasm_bindgen]
    pub fn address (source: Uint8Array) -> Result<JsString, Error> {
        let address = Address::decode_bytes(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(address.encode().into())
    }

    #[wasm_bindgen]
    pub fn tx (source: Uint8Array) -> Result<Object, Error> {
        let tx = Tx::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let header = tx.header();
        let result = Object::new();
        populate(&result, &[
            ("chainId".into(),    header.chain_id.as_str().into()),
            ("expiration".into(), header.expiration.map(|t|t.to_rfc3339()).into()),
            ("timestamp".into(),  header.timestamp.to_rfc3339().into()),
            ("codeHash".into(),   header.code_hash.raw().into()),
            ("dataHash".into(),   header.data_hash.raw().into()),
            ("memoHash".into(),   header.memo_hash.raw().into()),
            ("txType".into(),     match header.tx_type {
                TxType::Raw          => "Raw",
                TxType::Wrapper(_)   => "Wrapper",
                TxType::Decrypted(_) => "Decrypted",
                TxType::Protocol(_)  => "Protocol",
            }.into()),
        ])?;
        let sections = Array::new();
        for section_data in tx.sections.iter() {
            let section = Object::new();
            match section_data {

                Section::Data(data) => populate(&section, &[
                    ("type".into(), "Data".into()),
                    ("salt".into(), hex::encode_upper(&data.salt).into()),
                    ("data".into(), hex::encode_upper(&data.data).into()),
                ]),

                Section::ExtraData(code) => populate(&section, &[
                    ("type".into(), "ExtraData".into()),
                    ("salt".into(), hex::encode_upper(&code.salt).into()),
                    ("code".into(), hex::encode_upper(&code.code.hash().0).into()),
                    ("tag".into(),  if let Some(ref tag) = code.tag {
                        tag.into()
                    } else {
                        JsValue::NULL
                    }),
                ]),

                Section::Code(code) => populate(&section, &[
                    ("type".into(), "Code".into()),
                    ("salt".into(), hex::encode_upper(&code.salt).into()),
                    ("code".into(), hex::encode_upper(&code.code.hash().0).into()),
                    ("tag".into(),  if let Some(ref tag) = code.tag {
                        tag.into()
                    } else {
                        JsValue::NULL
                    }),
                ]),

                Section::Signature(signature) => populate(&section, &[
                    ("type".into(), "Signature".into()),
                    ("targets".into(), {
                        let targets = Array::new();
                        for target in signature.targets.iter() {
                            targets.push(&hex::encode_upper(target.0).into());
                        }
                        targets
                    }.into()),
                    ("signer".into(), match &signature.signer {
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
                        for (key, value) in signature.signatures.iter() {
                            Reflect::set(&output, &format!("{key}").into(), &format!("{value}").into())?;
                        }
                        output
                    }.into()),
                ]),

                Section::Ciphertext(ciphertext) => populate(&section, &[
                    ("type".into(), "Ciphertext".into()),
                ]),

                Section::MaspTx(transaction) => populate(&section, &[
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
                                    ("assetType".into(), format!("{}", tx_data.asset_type).into()),
                                    ("value".into(),     JsValue::from(BigInt::from(tx_data.value))),
                                    ("address".into(),   hex::encode_upper(tx_data.address.0).into()),
                                ])?.into());
                            }
                            let vout = Array::new();
                            for tx_data in bundle_data.vout.iter() {
                                vout.push(&object(&[
                                    ("assetType".into(), format!("{}", tx_data.asset_type).into()),
                                    ("value".into(),     JsValue::from(BigInt::from(tx_data.value))),
                                    ("address".into(),   hex::encode_upper(tx_data.address.0).into()),
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
                                    ("cv".into(),           format!("{}", &spend.cv).into()),
                                    ("anchor".into(),       hex::encode_upper(&spend.anchor.to_bytes()).into()),
                                    ("nullifier".into(),    hex::encode_upper(&spend.nullifier).into()),
                                    ("rk".into(),           format!("{}", &spend.rk.0).into()),
                                    ("zkproof".into(),      hex::encode_upper(&spend.zkproof).into()),
                                    //("spendAuthSig".into(), to_hex(&spend.spend_auth_sig).into()),
                                ])?.into());
                            }
                            let shielded_converts = Array::new();
                            for convert in bundle_data.shielded_converts.iter() {
                                shielded_converts.push(&object(&[
                                    ("cv".into(),      format!("{}", &convert.cv).into()),
                                    ("anchor".into(),  hex::encode_upper(&convert.anchor.to_bytes()).into()),
                                    ("zkproof".into(), hex::encode_upper(&convert.zkproof).into()),
                                ])?.into());
                            }
                            let shielded_outputs = Array::new();
                            for output in bundle_data.shielded_outputs.iter() {
                                shielded_outputs.push(&object(&[
                                    ("cv".into(),            format!("{}", &output.cv).into()),
                                    ("cmu".into(),           hex::encode_upper(&output.cmu.to_bytes()).into()),
                                    ("ephemeralKey".into(),  hex::encode_upper(&output.ephemeral_key.0).into()),
                                    ("encCiphertext".into(), hex::encode_upper(&output.enc_ciphertext).into()),
                                    ("outCiphertext".into(), hex::encode_upper(&output.out_ciphertext).into()),
                                    ("zkproof".into(),       hex::encode_upper(&output.zkproof).into()),
                                ])?.into());
                            }
                            let value_balance = Object::new();
                            for (asset_type, value) in bundle_data.value_balance.0.iter() {
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

                Section::MaspBuilder(masp_builder) => populate(&section, &[
                    ("type".into(),        "MaspBuilder".into()),
                    ("target".into(),      hex::encode_upper(masp_builder.target.0).into()),
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
                                    BigInt::from(epoch.0).into()
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
                ]),

                Section::Header(header) => populate(&section, &[
                    ("type".into(),       "Header".into()),
                    ("chain_id".into(),   header.chain_id.as_str().into()),
                    ("expiration".into(), header.expiration.map(|t|t.to_rfc3339()).into()),
                    ("timestamp".into(),  header.timestamp.to_rfc3339().into()),
                    ("codeHash".into(),   header.code_hash.raw().into()),
                    ("dataHash".into(),   header.data_hash.raw().into()),
                    ("memoHash".into(),   header.memo_hash.raw().into()),
                    ("txType".into(),     match header.tx_type {
                        TxType::Raw          => "Raw",
                        TxType::Wrapper(_)   => "Wrapper",
                        TxType::Decrypted(_) => "Decrypted",
                        TxType::Protocol(_)  => "Protocol",
                    }.into()),
                ]),

            }?;
            sections.push(&section);
        }
        Reflect::set(&result, &"sections".into(), &sections.into());
        Ok(result)
    }

}

#[inline]
fn populate (object: &Object, fields: &[(JsValue, JsValue)]) -> Result<(), Error> {
    for (key, val) in fields.iter() {
        Reflect::set(&object, &key.into(), &val.into())?;
    }
    Ok(())
}

#[inline]
fn object (fields: &[(JsValue, JsValue)]) -> Result<Object, Error> {
    let object = Object::new();
    populate(&object, fields)?;
    Ok(object)
}

#[inline]
fn to_bytes (source: &Uint8Array) -> Vec<u8> {
    let mut bytes: Vec<u8> = vec![0u8; source.length() as usize];
    source.copy_to(&mut bytes);
    bytes
}

#[inline]
fn to_hex (source: &mut impl std::io::Write) -> String {
    let mut output = vec![];
    source.write(&mut output);
    hex::encode_upper(&output)
}

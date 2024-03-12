extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect};
use namada::address::Address;
use namada::string_encoding::Format;
use namada::governance::parameters::GovernanceParameters;
use namada::tx::{Tx, Section};
use namada::tx::data::TxType;
use masp_primitives::transaction::Transaction;
use namada::core::borsh::BorshDeserialize;
use namada::storage::KeySeg;

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
        ])?;
        let sections = Array::new();
        for section_data in tx.sections.iter() {
            let section = Object::new();
            match section_data {
                Section::Data(data) => populate(&section, &[
                    ("type".into(), "Data".into()),
                    ("salt".into(), hex::encode_upper(data.salt).into()),
                    ("data".into(), hex::encode_upper(data.data).into()),
                ]),
                Section::ExtraData(code) => populate(&section, &[
                    ("type".into(), "ExtraData".into()),
                    ("salt".into(), hex::encode_upper(code.salt).into()),
                    ("code".into(), hex::encode_upper(code.code.hash().0).into()),
                    ("tag".into(),  code.tag.into()),
                ]),
                Section::Code(code) => populate(&section, &[
                    ("type".into(), "Code".into()),
                    ("salt".into(), hex::encode_upper(code.salt).into()),
                    ("code".into(), hex::encode_upper(code.code.hash().0).into()),
                    ("tag".into(),  code.tag.into()),
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
                    ("signer".into(), match signature.signer {
                        Signer::Address(address) => {
                            address.encode()
                        },
                        Signer::PubKeys(pubkeys) => {
                            let output = Array::new();
                            for pubkey in pubkeys.iter() {
                                output.push(&format!("{pubkey}").into());
                            }
                            output
                        },
                    }.into()),
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
                    ("type".into(),                "MaspTx".into()),
                    ("txid".into(),                transaction.txid().into()),
                    ("version".into(),             transaction.version().into()),
                    ("consensusBranchId".into(),   transaction.consensus_branch_id().into()),
                    ("lockTime".into(),            transaction.lock_time().into()),
                    ("expiryHeight".into(),        transaction.expiry_height().into()),
                    ("transparentBundle".into(),   transaction.transparent_bundle().into()),
                    ("saplingBundle".into(),       transaction.sapling_bundle().into()),
                    ("digest".into(),              transaction.digest().into()),
                    ("saplingValueBalance".into(), transaction.sapling_value_balance().into()),
                ]),
                Section::MaspBuilder(masp_builder) => populate(&section, &[
                    ("type".into(),        "MaspBuilder".into()),
                    ("target".into(),      masp_builder.hash.into()),
                    ("asset_types".into(), masp_builder.asset_types.into()),
                    ("metadata".into(),    masp_builder.metadata.into()),
                    ("builder".into(),     masp_builder.builder.into()),
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
        //Reflect::set(&result, &"txid".into(), &tx.txid().to_string().into())?;
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
fn to_bytes (source: &Uint8Array) -> Vec<u8> {
    let mut bytes: Vec<u8> = vec![0u8; source.length() as usize];
    source.copy_to(&mut bytes);
    bytes
}

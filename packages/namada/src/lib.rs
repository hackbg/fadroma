extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect, BigInt, Set};
use std::fmt::Write;
use std::io::Cursor;
use namada::{
    account::{
        InitAccount,
        UpdateAccount,
    },
    address::Address,
    core::borsh::BorshDeserialize,
    governance::storage::proposal::{
        InitProposalData,
        VoteProposalData
    },
    key::common::PublicKey,
    storage::KeySeg,
    string_encoding::Format,
    token::{
        MaspDigitPos,
        Transfer,
    },
    tx::{
        Tx, Header, Section, Data, Code, Signature, Signer, MaspBuilder,
        data::{
            TxType,
            pos::{
                BecomeValidator,
                Bond,
                ClaimRewards,
                CommissionChange,
                ConsensusKeyChange,
                MetaDataChange,
                Unbond,
                Withdraw
            },
            pgf::{
                UpdateStewardCommission
            },
        }
    },
};
//use masp_primitives::consensus::BranchId;
//use masp_primitives::transaction::Transaction;
//use masp_primitives::transaction::TxVersion;
//use namada::core::masp_primitives::TxVersion;
//use namada::governance::parameters::GovernanceParameters;

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
        let result = object(&[
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
            ("sections".into(),   {
                let sections = Array::new();
                for section in tx.sections.iter() {
                    sections.push(&JsValue::from(Self::tx_section(&section)?));
                }
                sections
            }.into())
        ])?;
        if let TxType::Decrypted(_) = tx.header().tx_type {
            Self::tx_content(tx, result)
        } else {
            Ok(result)
        }
    }

    fn tx_content (tx: Tx, result: Object) -> Result<Object, Error> {
        let mut tag: Option<String> = None;
        for section in tx.sections.iter() {
            if let Section::Code(code) = section {
                tag = code.tag.clone();
                if tag.is_some() {
                    break
                }
            }
        }
        if tag.is_none() {
            return Ok(result)
        }
        let mut binary: Option<&[u8]> = None;
        for section in tx.sections.iter() {
            if let Section::Data(data) = section {
                binary = Some(&data.data);
                break
            }
        }
        if binary.is_none() {
            return Ok(result)
        }
        let data = Object::new();
        let binary = binary.unwrap();
        let tag = tag.unwrap();
        match tag.as_str() {
            "tx_become_validator.wasm" => {
                let inner = BecomeValidator::try_from_slice(&binary[..]);
                populate(&data, &[
                    ("address".into(),), // Address
                    ("consensus_key".into(),), //PublicKey,
                    ("eth_cold_key".into(),), //PublicKey,
                    ("eth_hot_key".into(),), //PublicKey,
                    ("protocol_key".into(),), //PublicKey,
                    ("commission_rate".into(),), //Dec,
                    ("max_commission_rate_change".into(),), //Dec,
                    ("email".into(),), //String,
                    ("description".into(),), //Option<String>,
                    ("website".into(),), //Option<String>,
                    ("discord_handle".into(),), //Option<String>,
                    ("avatar".into(),), //Option<String>,
                ])?;
            },
            "tx_bond.wasm" => {
                let inner = Bond::try_from_slice(&binary[..]);
                /*    pub validator: Address,
    pub amount: Amount,
    pub source: Option<Address>,*/
            },
            "tx_bridge_pool.wasm" => {
                //let inner = BridgePool::try_from_slice(&binary[..]);
            },
            "tx_change_consensus_key.wasm" => {
                let inner = ConsensusKeyChange::try_from_slice(&binary[..]);
                /*   pub validator: Address,
    pub consensus_key: PublicKey,*/
            },
            "tx_change_validator_commission.wasm" => {
                let inner = CommissionChange::try_from_slice(&binary[..]);
                /* pub validator: Address,
    pub new_rate: Dec,*/
            },
            "tx_change_validator_metadata.wasm" => {
                let inner = MetaDataChange::try_from_slice(&binary[..]);
                /* pub validator: Address,
    pub email: Option<String>,
    pub description: Option<String>,
    pub website: Option<String>,
    pub discord_handle: Option<String>,
    pub avatar: Option<String>,
    pub commission_rate: Option<Dec>,*/
            },
            "tx_claim_rewards.wasm" => {
                let inner = ClaimRewards::try_from_slice(&binary[..]);
                /*    pub validator: Address,
    pub source: Option<Address>,*/
            },
            "tx_deactivate_validator.wasm" => {
                let inner = Address::try_from_slice(&binary[..]);
            },
            "tx_ibc.wasm" => {
                //let inner = IBC::try_from_slice(&binary[..]);
            },
            "tx_init_account.wasm" => {
                let inner = InitAccount::try_from_slice(&binary[..]);
                /*   pub public_keys: Vec<PublicKey>,
    pub vp_code_hash: Hash,
    pub threshold: u8,*/
            },
            "tx_init_proposal.wasm" => {
                let inner = InitProposalData::try_from_slice(&binary[..]);
                /*    pub id: u64,
    pub content: Hash,
    pub author: Address,
    pub type: ProposalType,
    pub voting_start_epoch: Epoch,
    pub voting_end_epoch: Epoch,
    pub grace_epoch: Epoch,*/
            },
            "tx_reactivate_validator.wasm" => {
                let inner = Address::try_from_slice(&binary[..]);
            },
            "tx_redelegate.wasm" => {
                //let inner = Redelegate::try_from_slice(&binary[..]);
            },
            "tx_resign_steward.wasm" => {
                let inner = Address::try_from_slice(&binary[..]);
            },
            "tx_reveal_pk.wasm" => {
                let inner = PublicKey::try_from_slice(&binary[..]);
            },
            "tx_transfer.wasm" => {
                let inner = Transfer::try_from_slice(&binary[..]);
                /*    pub source: Address,
    pub target: Address,
    pub token: Address,
    pub amount: DenominatedAmount,
    pub key: Option<String>,
    pub shielded: Option<Hash>,*/
            },
            "tx_unbond.wasm" => {
                let inner = Unbond::try_from_slice(&binary[..]);
                /*   pub validator: Address,
    pub amount: Amount,
    pub source: Option<Address>,*/
            },
            "tx_unjail_validator.wasm" => {
                let inner = Address::try_from_slice(&binary[..]);
            },
            "tx_update_account.wasm" => {
                let inner = UpdateAccount::try_from_slice(&binary[..]);
                /*    pub addr: Address,
    pub vp_code_hash: Option<Hash>,
    pub public_keys: Vec<PublicKey>,
    pub threshold: Option<u8>,*/
            },
            "tx_update_steward_commission.wasm" => {
                let inner = UpdateStewardCommission::try_from_slice(&binary[..]);
                /* pub addr: Address,
    pub vp_code_hash: Option<Hash>,
    pub public_keys: Vec<PublicKey>,
    pub threshold: Option<u8>*/
            },
            "tx_vote_proposal.wasm" => {
                let inner = VoteProposalData::try_from_slice(&binary[..]);
                /* pub id: u64,
    pub vote: ProposalVote,
    pub voter: Address,
    pub delegations: Vec<Address>,*/
            },
            "tx_withdraw.wasm" => {
                let inner = Withdraw::try_from_slice(&binary[..]);
                /*
    pub validator: Address,
    pub source: Option<Address>,*/
            },
            "vp_implicit.wasm" => {
                //let inner = VPImplicit::try_from_slice(&binary[..]);
            },
            "vp_user.wasm" => {
                //let inner = VPUser::try_from_slice(&binary[..]);
            },
            _ => {}
        }
        let content = object(&[
            ("type".into(), tag.into()),
            ("data".into(), data.into()),
        ])?;
        Reflect::set(&result, &"content".into(), &content.into())?;
        Ok(result)
    }

    fn tx_section (section_data: &Section) -> Result<Object, Error> {
        match section_data {
            Section::Data(data) =>
                Self::tx_section_data(data),
            Section::ExtraData(code) =>
                Self::tx_section_extra_data(code),
            Section::Code(code) =>
                Self::tx_section_code(code),
            Section::Signature(signature) =>
                Self::tx_section_signature(signature),
            Section::Ciphertext(_) =>
                Self::tx_section_ciphertext(()),
            Section::MaspBuilder(masp_builder) =>
                Self::tx_section_masp_builder(masp_builder),
            Section::Header(header) =>
                Self::tx_section_header(header),
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
        }
    }

    fn tx_section_data (data: &Data) -> Result<Object, Error> {
        object(&[
            ("type".into(), "Data".into()),
            ("salt".into(), hex::encode_upper(&data.salt).into()),
            ("data".into(), hex::encode_upper(&data.data).into()),
        ])
    }

    fn tx_section_extra_data (code: &Code) -> Result<Object, Error> {
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

    fn tx_section_code (code: &Code) -> Result<Object, Error> {
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

    fn tx_section_signature (signature: &Signature) -> Result<Object, Error> {
        object(&[
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
        ])
    }

    fn tx_section_ciphertext (ciphertext: ()) -> Result<Object, Error> {
        object(&[
            ("type".into(), "Ciphertext".into()),
        ])
    }

    fn tx_section_masp_builder (masp_builder: &MaspBuilder) -> Result<Object, Error> {
        object(&[
            ("type".into(),
                "MaspBuilder".into()),
            ("target".into(),
                hex::encode_upper(masp_builder.target.0).into()),
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
        ])
    }

    fn tx_section_header (header: &Header) -> Result<Object, Error> {
        object(&[
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
        ])
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

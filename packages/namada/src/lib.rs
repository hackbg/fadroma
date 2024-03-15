extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect, BigInt, Set};
use std::collections::{BTreeMap, BTreeSet};
use namada::{
    account::{
        InitAccount,
        UpdateAccount,
    },
    address::Address,
    core::borsh::{
        BorshSerialize,
        BorshDeserialize,
    },
    dec::Dec,
    governance::{
        parameters::GovernanceParameters,
        pgf::parameters::PgfParameters,
        storage::{
            proposal::{
                AddRemove,
                StorageProposal,
                InitProposalData,
                VoteProposalData,
                ProposalType,
                PGFAction,
                PGFTarget
            },
            vote::ProposalVote
        },
        utils::{
            ProposalResult,
            TallyResult,
            TallyType,
            Vote,
        }
    },
    hash::Hash,
    key::common::PublicKey,
    ledger::pos::{
        PosParams,
        types::{
            CommissionPair,
            ValidatorMetaData,
            ValidatorState,
            WeightedValidator,
        }
    },
    storage::KeySeg,
    string_encoding::Format,
    token::{
        Amount,
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
    state::Epoch
};

macro_rules! to_object {
    ($($id:literal = $val:expr, )+) => {
        {
            let object = Object::new();
            $(
                Reflect::set(&object, &$id.into(), &$val.to_js()?)?;
            )+
            object
        }
    }
}

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
    pub fn address (source: Uint8Array) -> Result<JsString, Error> {
        let address = Address::decode_bytes(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(address.encode().into())
    }

    #[wasm_bindgen]
    pub fn pos_parameters (source: Uint8Array) -> Result<Object, Error> {
        let params = PosParams::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "maxValidatorSlots"             = params.owned.max_validator_slots,
            "pipelineLen"                   = params.owned.pipeline_len,
            "unbondingLen"                  = params.owned.unbonding_len,
            "tmVotesPerToken"               = params.owned.tm_votes_per_token,
            "blockProposerReward"           = params.owned.block_proposer_reward,
            "blockVoteReward"               = params.owned.block_vote_reward,
            "maxInflationRate"              = params.owned.max_inflation_rate,
            "targetStakedRatio"             = params.owned.target_staked_ratio,
            "duplicateVoteMinSlashRate"     = params.owned.duplicate_vote_min_slash_rate,
            "lightClientAttackMinSlashRate" = params.owned.light_client_attack_min_slash_rate,
            "cubicSlashingWindowLength"     = params.owned.cubic_slashing_window_length,
            "validatorStakeThreshold"       = params.owned.validator_stake_threshold,
            "livenessWindowCheck"           = params.owned.liveness_window_check,
            "livenessThreshold"             = params.owned.liveness_threshold,
            "rewardsGainP"                  = params.owned.rewards_gain_p,
            "rewardsGainD"                  = params.owned.rewards_gain_d,
            "maxProposalPeriod"             = params.max_proposal_period,
        })
    }

    #[wasm_bindgen]
    pub fn pos_validator_metadata (source: Uint8Array) -> Result<Object, Error> {
        let meta = ValidatorMetaData::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "email"         = meta.email,
            "description"   = meta.description,
            "website"       = meta.website,
            "discordHandle" = meta.discord_handle,
            "avatar"        = meta.avatar,
        })
    }

    #[wasm_bindgen]
    pub fn pos_commission_pair (source: Uint8Array) -> Result<Object, Error> {
        let pair = CommissionPair::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "commissionRate"             = pair.commission_rate,
            "maxCommissioChangePerEpoch" = pair.max_commission_change_per_epoch,
        })
    }

    #[wasm_bindgen]
    pub fn pos_validator_state (source: Uint8Array) -> Result<JsValue, Error> {
        let state = ValidatorState::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(match state {
            ValidatorState::Consensus      => "Consensus",
            ValidatorState::BelowCapacity  => "BelowCapacity",
            ValidatorState::BelowThreshold => "BelowThreshold",
            ValidatorState::Inactive       => "Inactive",
            ValidatorState::Jailed         => "Jailed",
        }.into())
    }

    #[wasm_bindgen]
    pub fn pos_validator_set (source: Uint8Array) -> Result<JsValue, Error> {
        let validators: Vec<WeightedValidator> = Vec::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let result = Array::new();
        for validator in validators.iter() {
            result.push(&to_object! {
                "address"     = validator.address,
                "bondedStake" = validator.bonded_stake,
            }.into());
        }
        Ok(result.into())
    }

    #[wasm_bindgen]
    pub fn pgf_parameters (source: Uint8Array) -> Result<Object, Error> {
        let params = PgfParameters::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "stewards"              = params.stewards,
            "pgfInflationRate"      = params.pgf_inflation_rate,
            "stewardsInflationRate" = params.stewards_inflation_rate,
        })
    }

    #[wasm_bindgen]
    pub fn gov_parameters (source: Uint8Array) -> Result<Object, Error> {
        let params = GovernanceParameters::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "minProposalFund"         = params.min_proposal_fund,
            "maxProposalCodeSize"     = params.max_proposal_code_size,
            "minProposalVotingPeriod" = params.min_proposal_voting_period,
            "maxProposalPeriod"       = params.max_proposal_period,
            "maxProposalContentSize"  = params.max_proposal_content_size,
            "minProposalGraceEpochs"  = params.min_proposal_grace_epochs,
        })
    }

    #[wasm_bindgen]
    pub fn gov_proposal (source: Uint8Array) -> Result<Object, Error> {
        let proposal = StorageProposal::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "id"               = proposal.id,
            "content"          = proposal.content,
            "author"           = proposal.author,
            "type"             = proposal.r#type,
            "votingStartEpoch" = proposal.voting_start_epoch,
            "votingEndEpoch"   = proposal.voting_end_epoch,
            "graceEpoch"       = proposal.grace_epoch,
        })
    }

    #[wasm_bindgen]
    pub fn gov_votes (source: Uint8Array) -> Result<Array, Error> {
        let votes: Vec<Vote> = Vec::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let result = Array::new();
        for vote in votes.iter() {
            result.push(&to_object! {
                "validator" = vote.validator,
                "delegator" = vote.delegator,
                "data"      = vote.data,
            }.into());
        }
        Ok(result)
    }

    #[wasm_bindgen]
    pub fn gov_result (source: Uint8Array) -> Result<Object, Error> {
        let result = ProposalResult::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "result"            = result.result,
            "tallyType"         = result.tally_type,
            "totalVotingPower"  = result.total_voting_power,
            "totalYayPower"     = result.total_yay_power,
            "totalNayPower"     = result.total_nay_power,
            "totalAbstainPower" = result.total_abstain_power,
        })
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
        Self::tx_content(tx, result)
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
        let binary = binary.unwrap();
        let tag = tag.unwrap();
        let data = match tag.as_str() {
            "tx_become_validator.wasm" =>
                Self::tx_content_become_validator(binary),
            "tx_bond.wasm" =>
                Self::tx_content_bond(binary),
            "tx_bridge_pool.wasm" =>
                Ok(Object::new()),
            "tx_change_consensus_key.wasm" =>
                Self::tx_content_change_consensus_key(binary),
            "tx_change_validator_commission.wasm" =>
                Self::tx_content_change_validator_commission(binary),
            "tx_change_validator_metadata.wasm" =>
                Self::tx_content_change_validator_metadata(binary),
            "tx_claim_rewards.wasm" =>
                Self::tx_content_claim_rewards(binary),
            "tx_deactivate_validator.wasm" =>
                Self::tx_content_deactivate_validator(binary),
            "tx_ibc.wasm" =>
                Ok(Object::new()),
            "tx_init_account.wasm" =>
                Self::tx_content_init_account(binary),
            "tx_init_proposal.wasm" =>
                Self::tx_content_init_proposal(binary),
            "tx_reactivate_validator.wasm" =>
                Self::tx_content_reactivate_validator(binary),
            "tx_redelegate.wasm" =>
                Ok(Object::new()),
            "tx_resign_steward.wasm" =>
                Self::tx_content_resign_steward(binary),
            "tx_reveal_pk.wasm" =>
                Self::tx_content_reveal_pk(binary),
            "tx_transfer.wasm" =>
                Self::tx_content_transfer(binary),
            "tx_unbond.wasm" =>
                Self::tx_content_unbond(binary),
            "tx_unjail_validator.wasm" =>
                Self::tx_content_unjail_validator(binary),
            "tx_update_account.wasm" =>
                Self::tx_content_update_account(binary),
            "tx_update_steward_commission.wasm" =>
                Self::tx_content_update_steward_commission(binary),
            "tx_vote_proposal.wasm" =>
                Self::tx_content_vote_proposal(binary),
            "tx_withdraw.wasm" =>
                Self::tx_content_withdraw(binary),
            "vp_implicit.wasm" =>
                Ok(Object::new()),
            "vp_user.wasm" =>
                Ok(Object::new()),
            _ =>
                Ok(Object::new()),
        }?;
        let content = object(&[
            ("type".into(), tag.into()),
            ("data".into(), data.into()),
        ])?;
        Reflect::set(&result, &"content".into(), &content.into())?;
        Ok(result)
    }

    #[wasm_bindgen]
    pub fn tx_content_become_validator (binary: &[u8]) -> Result<Object, Error> {
        let inner = BecomeValidator::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("address".into(),
                inner.address.encode().into()), // Address
            ("consensusKey".into(),
                to_hex_borsh(&inner.consensus_key)?.into()), //PublicKey,
            ("ethColdKey".into(),
                to_hex_borsh(&inner.eth_cold_key)?.into()), //PublicKey,
            ("ethHotKey".into(),
                to_hex_borsh(&inner.eth_hot_key)?.into()), //PublicKey,
            ("protocolKey".into(),
                to_hex_borsh(&inner.protocol_key)?.into()), //PublicKey,
            ("commissionRate".into(),
                format!("{}", inner.commission_rate).into()), //Dec,
            ("maxCommissionRateChange".into(),
                format!("{}", inner.max_commission_rate_change).into()), //Dec,
            ("email".into(),
                inner.email.into()), //String,
            ("description".into(),
                inner.description.into()), //Option<String>,
            ("website".into(),
                inner.website.into()), //Option<String>,
            ("discord_handle".into(),
                inner.discord_handle.into()), //Option<String>,
            ("avatar".into(),
                inner.avatar.into()), //Option<String>,
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_bond (binary: &[u8]) -> Result<Object, Error> {
        let inner = Bond::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()), //    pub validator: Address,
            ("amount".into(),
                format!("{}", inner.amount).into()), // Amount
            ("source".into(),
                inner.source.map(|a|a.encode()).into()) //        pub source: Option<Address>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_change_consensus_key (binary: &[u8]) -> Result<Object, Error> {
        let inner = ConsensusKeyChange::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()), // Address,
            ("consensusKey".into(),
                format!("{}", inner.consensus_key).into()), //   pub consensus_key: PublicKey,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_change_validator_commission (binary: &[u8]) -> Result<Object, Error> {
        let inner = CommissionChange::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()), // Address,
            ("newRate".into(),
                format!("{}", inner.new_rate).into()), // Dec,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_change_validator_metadata (binary: &[u8]) -> Result<Object, Error> {
        let inner = MetaDataChange::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()), // validator: Address,
            ("email".into(),
                inner.email.into()),//    pub email: Option<String>,
            ("description".into(),
                inner.description.into()),//    pub description: Option<String>,
            ("website".into(),
                inner.website.into()), //    pub website: Option<String>,
            ("discordHandle".into(),
                inner.discord_handle.into()),//    pub discord_handle: Option<String>,
            ("avatar".into(),
                inner.avatar.into()),//    pub avatar: Option<String>,
            ("commissionRate".into(),
                inner.commission_rate.map(|x|format!("{x}")).into()),//   pub commission_rate: Option<Dec>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_claim_rewards (binary: &[u8]) -> Result<Object, Error> {
        let inner = ClaimRewards::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()),
            ("source".into(),
                inner.source.map(|a|a.encode()).into()), //    pub source: Option<Address>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_deactivate_validator (binary: &[u8]) -> Result<Object, Error> {
        let inner = Address::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("address".into(),
                inner.encode().into()),
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_init_account (binary: &[u8]) -> Result<Object, Error> {
        let inner = InitAccount::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("publicKeys".into(), {
                let result = Array::new();
                for pk in inner.public_keys.iter() {
                    result.push(&format!("{pk}").into());
                }
                result
            }.into()),//               /*   pub public_keys: Vec<PublicKey>,
            ("vpCodeHash".into(),
                (&format!("{}", inner.vp_code_hash)).into()), //    pub vp_code_hash: Hash,
            ("threshold".into(),
                inner.threshold.into()),//: u8,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_init_proposal (binary: &[u8]) -> Result<Object, Error> {
        let inner = InitProposalData::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("id".into(),
                inner.id.into()), //               /*    pub id: u64,
            ("content".into(),
                format!("{}", inner.content).into()),//: Hash,
            ("author".into(),
                inner.author.encode().into()), // Address,
            ("type".into(),
                format!("{}", inner.r#type).into()),//    pub type: ProposalType,
            ("votingStartEpoch".into(),
                inner.voting_start_epoch.0.into()), //  pub voting_start_epoch: Epoch,
            ("votingEndEpoch".into(),
                inner.voting_end_epoch.0.into()),//    pub voting_end_epoch: Epoch,
            ("graceEpoch".into(),
                inner.grace_epoch.0.into()),//    pub grace_epoch: Epoch,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_reactivate_validator (binary: &[u8]) -> Result<Object, Error> {
        let inner = Address::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_resign_steward (binary: &[u8]) -> Result<Object, Error> {
        let inner = Address::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_reveal_pk (binary: &[u8]) -> Result<Object, Error> {
        let inner = PublicKey::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_transfer (binary: &[u8]) -> Result<Object, Error> {
        let inner = Transfer::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("source".into(),
                inner.source.encode().into()),//        /*    pub source: Address,
            ("target".into(),
                inner.target.encode().into()),//pub target: Address,
            ("token".into(),
                inner.token.encode().into()),//pub token: Address,
            ("amount".into(),
                format!("{}", inner.amount).into()),//pub amount: DenominatedAmount,
            ("key".into(),
                inner.key.into()),//pub key: Option<String>,
            ("shielded".into(),
                inner.shielded.map(|x|format!("{x}")).into()),//pub shielded: Option<Hash>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_unbond (binary: &[u8]) -> Result<Object, Error> {
        let inner = Unbond::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()),//        /*   pub validator: Address,
            ("amount".into(),
                format!("{}", inner.amount).into()),//pub amount: Amount,
            ("source".into(),
                inner.source.map(|a|a.encode()).into()),//pub source: Option<Address>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_unjail_validator (binary: &[u8]) -> Result<Object, Error> {
        let inner = Address::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("address".into(),
                inner.encode().into()),
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_update_account (binary: &[u8]) -> Result<Object, Error> {
        let inner = UpdateAccount::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("addr".into(),
                inner.addr.encode().into()),//        /*    pub addr: Address,
            ("vpCodeHash".into(),
                inner.vp_code_hash.map(|x|format!("{x}")).into()),
            ("publicKeys".into(), {
                let result = Array::new();
                for pk in inner.public_keys.iter() {
                    result.push(&format!("{pk}").into());
                }
                result
            }.into()),
            ("threshold".into(),
                inner.threshold.into()),//pub threshold: Option<u8>,*/
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_update_steward_commission (binary: &[u8]) -> Result<Object, Error> {
        let inner = UpdateStewardCommission::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("steward".into(),
                inner.steward.encode().into()),
            ("commission".into(), {
                let result = Object::new();
                for (key, value) in inner.commission.iter() {
                    Reflect::set(
                        &result,
                        &key.encode().into(),
                        &format!("{value}").into(),
                    )?;
                }
                result
            }.into())
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_vote_proposal (binary: &[u8]) -> Result<Object, Error> {
        let inner = VoteProposalData::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("id".into(),
                inner.id.into()),//        /* pub id: u64,
            ("vote".into(),
                match inner.vote {
                    ProposalVote::Yay => "yay",
                    ProposalVote::Nay => "nay",
                    ProposalVote::Abstain => "abstain",
                }.into()),
            ("voter".into(),
                inner.voter.encode().into()),//pub voter: Address,
            ("delegations".into(), {
                let result = Array::new();
                for delegation in inner.delegations.iter() {
                    result.push(&delegation.encode().into());
                }
                result
            }.into()),
        ])
    }

    #[wasm_bindgen]
    pub fn tx_content_withdraw (binary: &[u8]) -> Result<Object, Error> {
        let inner = Withdraw::try_from_slice(&binary[..])
            .map_err(|e|Error::new(&format!("{e}")))?;
        object(&[
            ("validator".into(),
                inner.validator.encode().into()),//        /*pub validator: Address,
            ("source".into(),
                inner.source.map(|a|a.encode()).into()),//pub source: Option<Address>,*/
        ])
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

    fn tx_section_ciphertext (_ciphertext: ()) -> Result<Object, Error> {
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
fn to_hex (source: &mut impl std::io::Write) -> Result<String, Error> {
    let mut output = vec![];
    source.write(&mut output)
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(hex::encode_upper(&output))
}

#[inline]
fn to_hex_borsh (source: &impl BorshSerialize) -> Result<String, Error> {
    let mut output = vec![];
    source.serialize(&mut output)
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(hex::encode_upper(&output))
}

trait ToJS {
    fn to_js (&self) -> Result<JsValue, Error>;
}

impl ToJS for u64 {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok((*self).into())
    }
}

impl ToJS for Dec {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(format!("{}", self).into())
    }
}

impl ToJS for String {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(self.into())
    }
}

impl ToJS for Option<String> {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(if let Some(value) = self {
            value.into()
        } else {
            JsValue::NULL
        })
    }
}

impl ToJS for BTreeSet<Address> {
    fn to_js (&self) -> Result<JsValue, Error> {
        let set = Set::new(&JsValue::UNDEFINED);
        for value in self.iter() {
            set.add(&value.to_js()?);
        }
        Ok(set.into())
    }
}

impl ToJS for TallyResult {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::Passed   => "Passed",
            Self::Rejected => "Rejected"
        }.into())
    }
}

impl ToJS for TallyType {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::TwoThirds                  => "TwoThirds",
            Self::OneHalfOverOneThird        => "OneHalfOverOneThird",
            Self::LessOneHalfOverOneThirdNay => "LessOneHalfOverOneThirdNay"
        }.into())
    }
}

impl ToJS for Amount {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(format!("{}", self).into())
    }
}

impl ToJS for BTreeMap<String, String> {
    fn to_js (&self) -> Result<JsValue, Error> {
        let object = Object::new();
        for (key, value) in self.iter() {
            Reflect::set(&object, &key.into(), &value.into())?;
        }
        Ok(object.into())
    }
}

impl ToJS for Address {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(self.encode().into())
    }
}

impl ToJS for ProposalType {
    fn to_js (&self) -> Result<JsValue, Error> {
        let object = Object::new();
        match self {
            Self::Default(hash) => {
                Reflect::set(&object, &"type".into(), &"Default".into())?;
                Reflect::set(&object, &"hash".into(), &hash.to_js()?)?;
            },
            Self::PGFSteward(ops) => {
                let set = Set::new(&JsValue::UNDEFINED);
                for op in ops {
                    set.add(&op.to_js()?);
                }
                Reflect::set(&object, &"type".into(), &"PGFSteward".into())?;
                Reflect::set(&object, &"ops".into(), &set.into())?;
            },
            Self::PGFPayment(actions) => {
                let set = Set::new(&JsValue::UNDEFINED);
                for op in actions {
                    set.add(&op.to_js()?);
                }
                Reflect::set(&object, &"type".into(), &"PGFPayment".into())?;
                Reflect::set(&object, &"ops".into(), &set.into())?;
            }
        };
        Ok(object.into())
    }
}

impl ToJS for Epoch {
    fn to_js (&self) -> Result<JsValue, Error> {
        self.0.to_js()
    }
}

impl ToJS for ProposalVote {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::Yay => "Yay",
            Self::Nay => "Nay",
            Self::Abstain => "Abstain",
        }.into())
    }
}

impl ToJS for Option<Hash> {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(if let Some(hash) = self {
            to_hex_borsh(&hash)?.into()
        } else {
            JsValue::NULL
        })
    }
}

impl<T: ToJS> ToJS for AddRemove<T> {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::Add(value) => to_object! {
                "op"    = "Add",
                "value" = value.to_js()?,
            },
            Self::Remove(value) => to_object! {
                "op"    = "Remove",
                "value" = value.to_js()?,
            },
        }.into())
    }
}

impl ToJS for PGFAction {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::Continuous(value) => to_object! {
                "action" = "Continuous",
                "value"  = value.to_js()?,
            },
            Self::Retro(value) => to_object! {
                "action" = "Retro",
                "value"  = value.to_js()?,
            },
        }.into())
    }
}

impl ToJS for PGFTarget {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(match self {
            Self::Internal(target) => to_object! {
                "type"   = "Internal",
                "target" = target.target.to_js()?,
                "amount" = target.amount.to_js()?,
            },
            Self::Ibc(target) => to_object! {
                "type"       = "Ibc",
                "target"     = target.target.to_js()?,
                "amount"     = target.amount.to_js()?,
                "port_id"    = target.port_id.as_str().to_js()?,
                "channel_id" = target.channel_id.as_str().to_js()?,
            }
        }.into())
    }
}

impl ToJS for str {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(self.into())
    }
}

impl ToJS for JsValue {
    fn to_js (&self) -> Result<JsValue, Error> {
        Ok(self.clone())
    }
}

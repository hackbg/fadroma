use crate::{*, to_js::*};

#[wasm_bindgen]
pub struct Decode;

fn decode <T: namada::core::borsh::BorshDeserialize> (source: &Uint8Array) -> Result<T, Error> {
    T::try_from_slice(&to_bytes(&source)).map_err(|e|Error::new(&format!("{e}")))
}

#[wasm_bindgen]
impl Decode {

    #[wasm_bindgen]
    pub fn u32 (source: Uint8Array) -> Result<BigInt, Error> {
        decode::<u32>(&source).map(BigInt::from)
    }

    #[wasm_bindgen]
    pub fn u64 (source: Uint8Array) -> Result<BigInt, Error> {
        decode::<u64>(&source).map(BigInt::from)
    }

    #[wasm_bindgen]
    pub fn vec_string (source: Uint8Array) -> Result<Array, Error> {
        let values = Vec::<String>::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let result = Array::new();
        for value in values.into_iter() {
            result.push(&value.into());
        }
        Ok(result)
    }

    #[wasm_bindgen]
    pub fn code_hash (source: Uint8Array) -> Result<JsString, Error> {
        decode::<namada::core::hash::Hash>(&source)
            .map(hex::encode_upper)
            .map(JsString::from)
    }

    #[wasm_bindgen]
    pub fn storage_keys () -> Result<Object, Error> {
        Ok(to_object! {
            "epochDuration" =
                get_epoch_duration_storage_key().to_string(),
            "epochsPerYear" =
                get_epochs_per_year_key().to_string(),
            "gasCostTable" =
                get_gas_cost_key().to_string(),
            "gasScale" =
                get_gas_scale_key().to_string(),
            "implicitVpCodeHash" =
                get_implicit_vp_key().to_string(),
            "maspEpochMultipler" =
                get_masp_epoch_multiplier_key().to_string(),
            "maspFeePaymentGasLimit" =
                get_masp_fee_payment_gas_limit_key().to_string(),
            "maxBlockGas" =
                get_max_block_gas_key().to_string(),
            "maxProposalBytes" =
                get_max_proposal_bytes_key().to_string(),
            "maxTxBytes" =
                get_max_tx_bytes_key().to_string(),
            "isNativeTokenTransferable" =
                get_native_token_transferable_key().to_string(),
            "txAllowlist" =
                get_tx_allowlist_storage_key().to_string(),
            "vpAllowlist" =
                get_vp_allowlist_storage_key().to_string(),
        })
    }

    #[wasm_bindgen]
    pub fn epoch_duration (source: Uint8Array) -> Result<Object, Error> {
        let data = EpochDuration::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(to_object! {
            "minNumOfBlocks" =
                data.min_num_of_blocks,
            "minDuration" =
                data.min_duration.0,
        })
    }

    #[wasm_bindgen]
    pub fn gas_cost_table (source: Uint8Array) -> Result<Object, Error> {
        let data = BTreeMap::<namada::core::address::Address, namada::token::Amount>
            ::try_from_slice(&to_bytes(&source)).map_err(|e|Error::new(&format!("{e}")))?;
        let result = Object::new();
        for (key, val) in data.iter() {
            Reflect::set(&result, &format!("{key}").into(), &format!("{val}").into())?;
        }
        Ok(result)
    }

    #[wasm_bindgen]
    pub fn tx (source: Uint8Array) -> Result<Object, Error> {
        let tx = Tx::try_from_slice(&to_bytes(&source)).map_err(|e|Error::new(&format!("{e}")))?;
        crate::tx::tx(&tx)
    }

    #[wasm_bindgen]
    pub fn address (source: Uint8Array) -> Result<JsString, Error> {
        let address = Address::decode_bytes(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(address.encode().into())
    }

    #[wasm_bindgen]
    pub fn addresses (source: Uint8Array) -> Result<Array, Error> {
        let addresses: Vec<Address> = Vec::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let result = Array::new();
        for address in addresses.iter() {
            result.push(&address.encode().into());
        }
        Ok(result.into())
    }

    #[wasm_bindgen]
    pub fn address_to_amount (source: Uint8Array) -> Result<Object, Error> {
        let data: HashMap<Address, Amount> = HashMap::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        let result = Object::new();
        for (address, amount) in data.iter() {
            Reflect::set(&result, &address.encode().into(), &amount.to_js()?)?;
        }
        Ok(result.into())
    }

    #[wasm_bindgen]
    pub fn block (
        block_json: String,
        block_results_json: String
    ) -> Result<Object, Error> {
        let block = BlockResponse::from_string(&block_json)
            .map_err(|e|Error::new(&format!("{e}")))?;
        let _ = BlockResultsResponse::from_string(&block_results_json)
            .map_err(|e|Error::new(&format!("{e}")))?;
        let header = block.block.header();
        let mut transactions: Vec<Object> = Vec::with_capacity(block.block.data.len());
        for tx in block.block.data.iter() {
            let tx = Tx::try_from(tx.as_slice());
            let tx = tx.map_err(|e|Error::new(&format!("{e}")));
            transactions.push(crate::tx::tx(&tx?)?);
        };
        Ok(to_object! {
            "hash"         = format!("{}", header.hash()),
            "transactions" = transactions,
            "header"       = to_object! {
                "version"  = to_object! {
                    "block"          = header.version.block,
                    "app"            = header.version.app,
                },
                "chainId"            = header.chain_id.as_str(),
                "height"             = header.height.value(),
                "time"               = header.time.to_rfc3339(),
                "proposerAddress"    = hex::encode_upper(
                    header.proposer_address.as_bytes()
                ),
                "dataHash"           = header.data_hash.map(
                    |hash|hex::encode_upper(hash.as_bytes())
                ),
                "validatorsHash"     = hex::encode_upper(
                    header.validators_hash.as_bytes()
                ),
                "nextValidatorsHash" = hex::encode_upper(
                    header.next_validators_hash.as_bytes()
                ),
                "consensusHash"      = hex::encode_upper(
                    header.consensus_hash.as_bytes()
                ),
                "appHash"            = hex::encode_upper(
                    header.app_hash.as_bytes()
                ),
                "lastResultsHash"    = header.last_results_hash.map(
                    |hash|hex::encode_upper(hash.as_bytes())
                ),
                "evidenceHash"       = header.evidence_hash.map(
                    |hash|hex::encode_upper(hash.as_bytes())
                ),
                "lastBlockId"        = if let Some(id) = header.last_block_id {
                    Some(to_object! {
                        "hash"           = hex::encode_upper(id.hash.as_bytes()),
                        "partSetHeader"  = to_object! {
                            "total"      = format!("{}", id.part_set_header.total),
                            "hash"       = hex::encode_upper(id.part_set_header.hash.as_bytes()),
                        },
                    })
                } else {
                    None
                },
                "lastCommitHash"     = header.last_commit_hash.map(
                    |hash|hex::encode_upper(hash.as_bytes())
                ),
            },
        })
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
            "name"          = meta.name,
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
            "commissionRate"              = pair.commission_rate,
            "maxCommissionChangePerEpoch" = pair.max_commission_change_per_epoch,
            "epoch"                       = pair.epoch,
        })
    }

    #[wasm_bindgen]
    pub fn pos_validator_state (source: Uint8Array) -> Result<JsValue, Error> {
        let (state, epoch) = ValidatorStateInfo::try_from_slice(&to_bytes(&source))
            .map_err(|e|Error::new(&format!("{e}")))?;
        Ok(JsValue::from(object(&[
            ("state".into(), match state {
                Some(ValidatorState::Consensus) => "Consensus".into(),
                Some(ValidatorState::BelowCapacity) => "BelowCapacity".into(),
                Some(ValidatorState::BelowThreshold) => "BelowThreshold".into(),
                Some(ValidatorState::Inactive) => "Inactive".into(),
                Some(ValidatorState::Jailed) => "Jailed".into(),
                None => JsValue::UNDEFINED,
            }),
            ("epoch".into(), epoch.0.into()),
        ])?))
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
            "activationEpoch"  = proposal.activation_epoch,
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
}

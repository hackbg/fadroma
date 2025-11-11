use crate::*;

pub fn tx_content (tx: &Tx, result: Object) -> Result<Object, Error> {
    let mut content: Vec<Object> = Vec::new();
    let mut tag: Option<String> = None;
    let mut wait_data = false;
    for section in tx.sections.iter() {
        if let Section::Code(code) = section {
            tag = code.tag.clone();
            if tag.is_some() {
                wait_data = true;
            }
        } else if let Section::Data(data) = section {
            if wait_data {
                let used_tag = tag.clone().unwrap();
                let data = match used_tag.as_str() {
                    "tx_become_validator.wasm" => become_validator(&data.data),
                    "tx_bond.wasm" => bond(&data.data),
                    "tx_bridge_pool.wasm" => bridge_pool(&data.data),
                    "tx_change_consensus_key.wasm" => change_consensus_key(&data.data),
                    "tx_change_validator_commission.wasm" => change_validator_commission(&data.data),
                    "tx_change_validator_metadata.wasm" => change_validator_metadata(&data.data),
                    "tx_claim_rewards.wasm" => claim_rewards(&data.data),
                    "tx_deactivate_validator.wasm" => deactivate_validator(&data.data),
                    "tx_ibc.wasm" => Ok(Object::new()),
                    "tx_init_account.wasm" => init_account(&data.data),
                    "tx_init_proposal.wasm" => init_proposal(&data.data),
                    "tx_reactivate_validator.wasm" => reactivate_validator(&data.data),
                    "tx_redelegate.wasm" => redelegate(&data.data),
                    "tx_resign_steward.wasm" => resign_steward(&data.data),
                    "tx_reveal_pk.wasm" => reveal_pk(&data.data),
                    "tx_transfer.wasm" => transfer(&data.data),
                    "tx_unbond.wasm" => unbond(&data.data),
                    "tx_unjail_validator.wasm" => unjail_validator(&data.data),
                    "tx_update_account.wasm" => update_account(&data.data),
                    "tx_update_steward_commission.wasm" => update_steward_commission(&data.data),
                    "tx_vote_proposal.wasm" => vote_proposal(&data.data),
                    "tx_withdraw.wasm" => withdraw(&data.data),
                    "vp_implicit.wasm" => Ok(Object::new()),
                    "vp_user.wasm" => Ok(Object::new()),
                    _ => Ok(Object::new()),
                }?;
                content.push(object(&[
                    ("type".into(), used_tag.into()),
                    ("data".into(), data.into()),
                ])?);
            }
        } else {
            wait_data = false;
        }
    }
    Reflect::set(&result, &"content".into(), &content.into())?;
    Ok(result)
}

fn become_validator (binary: &[u8]) -> Result<Object, Error> {
    let inner = BecomeValidator::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(), inner.address.encode().into()),
        ("consensusKey".into(), to_hex_borsh(&inner.consensus_key)?.into()),
        ("ethColdKey".into(), to_hex_borsh(&inner.eth_cold_key)?.into()),
        ("ethHotKey".into(), to_hex_borsh(&inner.eth_hot_key)?.into()),
        ("protocolKey".into(), to_hex_borsh(&inner.protocol_key)?.into()),
        ("commissionRate".into(), format!("{}", inner.commission_rate).into()),
        ("maxCommissionRateChange".into(), format!("{}", inner.max_commission_rate_change).into()),
        ("email".into(), inner.email.into()),
        ("description".into(), inner.description.into()),
        ("website".into(), inner.website.into()),
        ("discordHandle".into(), inner.discord_handle.into()),
        ("avatar".into(), inner.avatar.into()),
        ("name".into(), inner.name.into()),
    ])
}

fn bond (binary: &[u8]) -> Result<Object, Error> {
    let inner = Bond::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),
        ("amount".into(), format!("{}", inner.amount).into()),
        ("source".into(), inner.source.map(|a|a.encode()).into())
    ])
}

fn bridge_pool (_binary: &[u8]) -> Result<Object, Error> {
    // TODO
    Ok(Object::new())
    //let inner = BridgePool::try_from_slice(&binary[..])
        //.map_err(|e|Error::new(&format!("{e}")))?;
    //Ok(to_object! {
        //"tx_hash" = inner.tx_hash,
        //"status"  = inner.status,
    //})
}

fn change_consensus_key (binary: &[u8]) -> Result<Object, Error> {
    let inner = ConsensusKeyChange::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),
        ("consensusKey".into(), format!("{}", inner.consensus_key).into()),
    ])
}

fn change_validator_commission (binary: &[u8]) -> Result<Object, Error> {
    let inner = CommissionChange::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),
        ("newRate".into(), format!("{}", inner.new_rate).into()),
    ])
}

fn change_validator_metadata (binary: &[u8]) -> Result<Object, Error> {
    let inner = MetaDataChange::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),
        ("email".into(), inner.email.into()),
        ("description".into(), inner.description.into()),
        ("website".into(), inner.website.into()),
        ("discordHandle".into(), inner.discord_handle.into()),
        ("avatar".into(), inner.avatar.into()),
        ("commissionRate".into(), inner.commission_rate.map(|x|format!("{x}")).into()),
        ("name".into(), inner.name.into()),
    ])
}

fn claim_rewards (binary: &[u8]) -> Result<Object, Error> {
    let inner = ClaimRewards::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(),
            inner.validator.encode().into()),
        ("source".into(),
            inner.source.map(|a|a.encode()).into()), //    pub source: Option<Address>,*/
    ])
}

fn deactivate_validator (binary: &[u8]) -> Result<Object, Error> {
    let inner = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(),
            inner.encode().into()),
    ])
}

fn init_account (binary: &[u8]) -> Result<Object, Error> {
    let inner = InitAccount::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("publicKeys".into(), {
            let result = Array::new();
            for pk in inner.public_keys.iter() {
                result.push(&format!("{pk}").into());
            }
            result
        }.into()),
        ("vpCodeHash".into(), (&format!("{}", inner.vp_code_hash)).into()),
        ("threshold".into(), inner.threshold.into()),
    ])
}

fn init_proposal (binary: &[u8]) -> Result<Object, Error> {
    let inner = InitProposalData::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! {
        "content"          = inner.content,
        "author"           = inner.author,
        "type"             = inner.r#type,
        "votingStartEpoch" = inner.voting_start_epoch,
        "votingEndEpoch"   = inner.voting_end_epoch,
        "activationEpoch"  = inner.activation_epoch,
    })
}

fn reactivate_validator (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! {
        "address" = address,
    })
}

fn redelegate (binary: &[u8]) -> Result<Object, Error> {
    let inner = Redelegation::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! {
        "srcValidator"  = inner.src_validator,
        "destValidator" = inner.dest_validator,
        "owner"         = inner.owner,
        "amount"        = inner.amount,
    })
}

fn resign_steward (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! {
        "address" = address,
    })
}

fn reveal_pk (binary: &[u8]) -> Result<Object, Error> {
    let pk = PublicKey::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! {
        "pk" = pk,
    })
}

fn transfer (binary: &[u8]) -> Result<Object, Error> {
    let inner = Transfer::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    let sources = Array::new();
    let targets = Array::new();
    for (key, value) in inner.sources.iter() {
        let source = Array::new();
        source.push(&key.to_js()?);
        source.push(&value.to_js()?);
        sources.push(&source);
    }
    for (key, value) in inner.targets.iter() {
        let target = Array::new();
        target.push(&key.to_js()?);
        target.push(&value.to_js()?);
        targets.push(&target);
    }
    Ok(to_object! {
        "sources" = sources,
        "targets" = targets,
        "shieldedSectionHash" = inner.shielded_section_hash
            .map(|hash|format!("{:?}", hash)),
    })
}

fn unbond (binary: &[u8]) -> Result<Object, Error> {
    let inner = Unbond::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),
        ("amount".into(), format!("{}", inner.amount).into()),
        ("source".into(), inner.source.map(|a|a.encode()).into()),
    ])
}

fn unjail_validator (binary: &[u8]) -> Result<Object, Error> {
    let inner = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(), inner.encode().into()),
    ])
}

fn update_account (binary: &[u8]) -> Result<Object, Error> {
    let inner = UpdateAccount::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(), inner.addr.encode().into()),
        ("vpCodeHash".into(), inner.vp_code_hash.map(|x|format!("{x}")).into()),
        ("publicKeys".into(), {
            let result = Array::new();
            for pk in inner.public_keys.iter() {
                result.push(&format!("{pk}").into());
            }
            result
        }.into()),
        ("threshold".into(), inner.threshold.into()),
    ])
}

fn update_steward_commission (binary: &[u8]) -> Result<Object, Error> {
    let inner = UpdateStewardCommission::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("steward".into(), inner.steward.encode().into()),
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

fn vote_proposal (binary: &[u8]) -> Result<Object, Error> {
    let inner = VoteProposalData::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("id".into(), inner.id.into()),
        ("vote".into(),
            match inner.vote {
                ProposalVote::Yay => "yay",
                ProposalVote::Nay => "nay",
                ProposalVote::Abstain => "abstain",
            }.into()),
        ("voter".into(), inner.voter.encode().into()),
    ])
}

fn withdraw (binary: &[u8]) -> Result<Object, Error> {
    let inner = Withdraw::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(), inner.validator.encode().into()),//        /*pub validator: Address,
        ("source".into(), inner.source.map(|a|a.encode()).into()),//pub source: Option<Address>,*/
    ])
}



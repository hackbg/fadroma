use crate::{*, to_js::*};

pub fn tx_content (tx: &Tx, result: Object) -> Result<Object, Error> {
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
        "tx_become_validator.wasm" => become_validator(binary),
        "tx_bond.wasm" => bond(binary),
        "tx_bridge_pool.wasm" => bridge_pool(binary),
        "tx_change_consensus_key.wasm" => change_consensus_key(binary),
        "tx_change_validator_commission.wasm" => change_validator_commission(binary),
        "tx_change_validator_metadata.wasm" => change_validator_metadata(binary),
        "tx_claim_rewards.wasm" => claim_rewards(binary),
        "tx_deactivate_validator.wasm" => deactivate_validator(binary),
        "tx_ibc.wasm" => Ok(Object::new()),
        "tx_init_account.wasm" => init_account(binary),
        "tx_init_proposal.wasm" => init_proposal(binary),
        "tx_reactivate_validator.wasm" => reactivate_validator(binary),
        "tx_redelegate.wasm" => redelegate(binary),
        "tx_resign_steward.wasm" => resign_steward(binary),
        "tx_reveal_pk.wasm" => reveal_pk(binary),
        "tx_transfer.wasm" => transfer(binary),
        "tx_unbond.wasm" => unbond(binary),
        "tx_unjail_validator.wasm" => unjail_validator(binary),
        "tx_update_account.wasm" => update_account(binary),
        "tx_update_steward_commission.wasm" => update_steward_commission(binary),
        "tx_vote_proposal.wasm" => vote_proposal(binary),
        "tx_withdraw.wasm" => withdraw(binary),
        "vp_implicit.wasm" => Ok(Object::new()),
        "vp_user.wasm" => Ok(Object::new()),
        _ => Ok(Object::new()),
    }?;
    let content = object(&[
        ("type".into(), tag.into()),
        ("data".into(), data.into()),
    ])?;
    Reflect::set(&result, &"content".into(), &content.into())?;
    Ok(result)
}

fn become_validator (binary: &[u8]) -> Result<Object, Error> {
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
        ("discordHandle".into(),
            inner.discord_handle.into()), //Option<String>,
        ("avatar".into(),
            inner.avatar.into()), //Option<String>,
    ])
}

fn bond (binary: &[u8]) -> Result<Object, Error> {
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
        ("validator".into(),
            inner.validator.encode().into()), // Address,
        ("consensusKey".into(),
            format!("{}", inner.consensus_key).into()), //   pub consensus_key: PublicKey,*/
    ])
}

fn change_validator_commission (binary: &[u8]) -> Result<Object, Error> {
    let inner = CommissionChange::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(),
            inner.validator.encode().into()), // Address,
        ("newRate".into(),
            format!("{}", inner.new_rate).into()), // Dec,*/
    ])
}

fn change_validator_metadata (binary: &[u8]) -> Result<Object, Error> {
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
        }.into()),//               /*   pub public_keys: Vec<PublicKey>,
        ("vpCodeHash".into(),
            (&format!("{}", inner.vp_code_hash)).into()), //    pub vp_code_hash: Hash,
        ("threshold".into(),
            inner.threshold.into()),//: u8,*/
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
    Ok(to_object! {
        "sources" = inner.sources,
        "targets" = inner.targets,
        "shieldedSectionHash" = inner.shielded_section_hash
            .map(|hash|format!("{:?}", hash)),
    })
}

fn unbond (binary: &[u8]) -> Result<Object, Error> {
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

fn unjail_validator (binary: &[u8]) -> Result<Object, Error> {
    let inner = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(),
            inner.encode().into()),
    ])
}

fn update_account (binary: &[u8]) -> Result<Object, Error> {
    let inner = UpdateAccount::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("address".into(),
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

fn update_steward_commission (binary: &[u8]) -> Result<Object, Error> {
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

fn vote_proposal (binary: &[u8]) -> Result<Object, Error> {
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
    ])
}

fn withdraw (binary: &[u8]) -> Result<Object, Error> {
    let inner = Withdraw::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    object(&[
        ("validator".into(),
            inner.validator.encode().into()),//        /*pub validator: Address,
        ("source".into(),
            inner.source.map(|a|a.encode()).into()),//pub source: Option<Address>,*/
    ])
}



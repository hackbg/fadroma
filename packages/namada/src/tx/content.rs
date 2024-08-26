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
        "tx_become_validator.wasm" => become_validator(binary)?,
        "tx_bond.wasm" => bond(binary)?,
        "tx_bridge_pool.wasm" => bridge_pool(binary)?.into(),
        "tx_change_consensus_key.wasm" => change_consensus_key(binary)?,
        "tx_change_validator_commission.wasm" => change_validator_commission(binary)?,
        "tx_change_validator_metadata.wasm" => change_validator_metadata(binary)?,
        "tx_claim_rewards.wasm" => claim_rewards(binary)?.into(),
        "tx_deactivate_validator.wasm" => deactivate_validator(binary)?.into(),
        "tx_ibc.wasm" => Object::new().into(),
        "tx_init_account.wasm" => init_account(binary)?,
        "tx_init_proposal.wasm" => init_proposal(binary)?.into(),
        "tx_reactivate_validator.wasm" => reactivate_validator(binary)?.into(),
        "tx_redelegate.wasm" => redelegate(binary)?.into(),
        "tx_resign_steward.wasm" => resign_steward(binary)?.into(),
        "tx_reveal_pk.wasm" => reveal_pk(binary)?.into(),
        "tx_transfer.wasm" => transfer(binary)?.into(),
        "tx_unbond.wasm" => unbond(binary)?.into(),
        "tx_unjail_validator.wasm" => unjail_validator(binary)?.into(),
        "tx_update_account.wasm" => update_account(binary)?,
        "tx_update_steward_commission.wasm" => update_steward_commission(binary)?,
        "tx_vote_proposal.wasm" => vote_proposal(binary)?,
        "tx_withdraw.wasm" => withdraw(binary)?.into(),
        "vp_implicit.wasm" => Object::new().into(),
        "vp_user.wasm" => Object::new().into(),
        _ => {
            // TODO: console warn
            Object::new().into()
        },
    };
    let content = object(&[
        ("type".into(), tag.into()),
        ("data".into(), data.into()),
    ])?;
    Reflect::set(&result, &"content".into(), &content.into())?;
    Ok(result)
}

fn become_validator (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => BecomeValidator)
}

fn bond (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => Bond)
}

fn change_consensus_key (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => ConsensusKeyChange)
}

fn change_validator_commission (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => CommissionChange)
}

fn change_validator_metadata (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => MetaDataChange)
}

fn claim_rewards (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => ClaimRewards)
}

fn init_account (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => InitAccount)
}

fn init_proposal (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => InitProposalData)
}

fn redelegate (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => Redelegation)
}

fn transfer (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => Transfer)
}

fn unbond (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => Unbond)
}

fn update_account (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => UpdateAccount)
}

fn update_steward_commission (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => UpdateStewardCommission)
}

fn vote_proposal (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => VoteProposalData)
}

fn withdraw (binary: &[u8]) -> Result<JsValue, JsValue> {
    auto_decode!(binary => Withdraw)
}

fn deactivate_validator (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! { "address" = address, })
}

fn reactivate_validator (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! { "address" = address, })
}

fn resign_steward (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! { "address" = address, })
}

fn reveal_pk (binary: &[u8]) -> Result<Object, Error> {
    let pk = PublicKey::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! { "pk" = pk, })
}

fn unjail_validator (binary: &[u8]) -> Result<Object, Error> {
    let address = Address::try_from_slice(&binary[..])
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(to_object! { "address" = address, })
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

use crate::*;

mod content;
mod section;

pub use self::{
    content::tx_content,
    section::tx_sections,
};

pub fn tx (tx: &Tx) -> Result<Object, Error> {
    tx_content(tx, to_object! {
        "id"         = hex::encode_upper(&tx.header_hash().to_vec()),
        "chainId"    = tx.header().chain_id.as_str(),
        "expiration" = tx.header().expiration.map(|t|t.to_rfc3339()),
        "timestamp"  = tx.header().timestamp.to_rfc3339(),
        "type"       = tx_type(&tx)?,
        "atomic"     = tx.header().atomic,
        "batch"      = tx_batch(&tx)?,
        "sections"   = tx_sections(&tx)?,
    })
}

pub fn tx_type (tx: &Tx) -> Result<Object, Error> {
    Ok(match tx.header().tx_type {
        TxType::Wrapper(tx) => {
            let multiplier: u64 = tx.gas_limit.into();
            to_object! {
                "Wrapper" = to_object! {
                    "fee"                 = tx.fee,
                    "pk"                  = tx.pk,
                    "payer"               = tx.fee_payer(),
                    "gasLimit"            = tx.gas_limit,
                    "feeAmountPerGasUnit" = tx.fee.amount_per_gas_unit.to_string_precise(),
                    "feeToken"            = tx.fee.token.to_string(),
                    "multiplier"          = multiplier,
                    "gasLimitMultiplier"  = multiplier as i64,
                },
            }
        },
        TxType::Protocol(txp) => to_object! {
            "Protocol" = to_object! {
                "pk" = txp.pk,
                "tx" = match txp.tx {
                    ProtocolTxType::EthereumEvents     => "EthereumEvents",
                    ProtocolTxType::BridgePool         => "BridgePool",
                    ProtocolTxType::ValidatorSetUpdate => "ValidatorSetUpdate",
                    ProtocolTxType::EthEventsVext      => "EthEventsVext",
                    ProtocolTxType::BridgePoolVext     => "BridgePoolVext",
                    ProtocolTxType::ValSetUpdateVext   => "ValSetUpdateVext",
                },
            },
        },
        TxType::Raw => to_object! {
            "Raw" = Object::new(),
        }
    })
}

pub fn tx_batch (tx: &Tx) -> Result<Array, Error> {
    let batch = Array::new();
    for commitment in tx.header().batch.iter() {
        batch.push(&JsValue::from(object(&[
            ("hash".into(),     commitment.get_hash().raw().into()),
            ("codeHash".into(), commitment.code_sechash().raw().into()),
            ("dataHash".into(), commitment.data_sechash().raw().into()),
            ("memoHash".into(), commitment.memo_sechash().raw().into()),
        ])?));
    }
    Ok(batch)
}

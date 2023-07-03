use std::convert::{TryFrom, TryInto};

#[cfg(feature = "ensemble-staking")]
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::cosmwasm_std::{Response, Attribute, Event};
use super::{
    EnsembleResult, EnsembleError,
    response::{
        InstantiateResponse, ExecuteResponse, BankResponse, ReplyResponse
    }
};
#[cfg(feature = "ensemble-staking")]
use super::response::{StakingResponse, StakingOp, DistributionResponse, DistributionOp};

const CONTRACT_ATTR: &str = "contract_address";

pub struct ProcessedEvents(Vec<Event>);

impl ProcessedEvents {
    #[inline]
    pub fn empty() -> Self {
        Self(vec![])
    }

    pub fn extend<T: TryInto<Self, Error = EnsembleError>>(
        &mut self,
        resp: T
    ) -> EnsembleResult<()> {
        let events = resp.try_into()?;
        self.0.extend(events.0);

        Ok(())
    }

    #[inline]
    pub fn take(self) -> Vec<Event> {
        self.0
    }
}

impl TryFrom<&InstantiateResponse> for ProcessedEvents {
    type Error = EnsembleError;

    fn try_from(resp: &InstantiateResponse) -> Result<Self, Self::Error> {
        validate_response(&resp.response)?;

        let address = resp.instance.address.as_str();
        let event = Event::new("instantiate")
            .add_attribute(CONTRACT_ATTR, address)
            .add_attribute("code_id", resp.code_id.to_string());

        Ok(process_wasm_response(
            &resp.response,
            address.into(),
            event
        ))
    }
}

impl TryFrom<&ExecuteResponse> for ProcessedEvents {
    type Error = EnsembleError;

    fn try_from(resp: &ExecuteResponse) -> Result<Self, Self::Error> {
        validate_response(&resp.response)?;

        let address = resp.address.as_str();
        let event = Event::new("execute")
            .add_attribute(CONTRACT_ATTR, address);

        Ok(process_wasm_response(
            &resp.response,
            address.into(),
            event
        ))
    }
}

impl TryFrom<&ReplyResponse> for ProcessedEvents {
    type Error = EnsembleError;

    fn try_from(resp: &ReplyResponse) -> Result<Self, Self::Error> {
        validate_response(&resp.response)?;

        let address = resp.address.as_str();
        let event = Event::new("reply")
            .add_attribute(CONTRACT_ATTR, address);

        Ok(process_wasm_response(
            &resp.response,
            address.into(),
            event
        ))
    }
}

impl From<&BankResponse> for ProcessedEvents {
    fn from(resp: &BankResponse) -> Self {
        let coins: String = resp.coins.iter()
            .map(|x| format!("{}{}", x.amount, x.denom))
            .collect::<Vec<String>>()
            .join(",");

        Self(vec![
            Event::new("coin_spent")
                .add_attribute("amount", coins.clone())
                .add_attribute("spender", &resp.sender),

            Event::new("coin_received")
                .add_attribute("amount", coins.clone())
                .add_attribute("receiver", &resp.receiver),

            Event::new("transfer")
                .add_attribute("amount", coins)
                .add_attribute("recipient", &resp.receiver)
                .add_attribute("sender", &resp.sender)
        ])
    }
}

#[cfg(feature = "ensemble-staking")]
impl From<&StakingResponse> for ProcessedEvents {
    fn from(resp: &StakingResponse) -> Self {
        let amount_value = format!("{}{}", resp.amount.amount, resp.amount.denom);
        
        let event = match &resp.kind {
            StakingOp::Delegate { validator } =>
                Event::new("delegate")
                    .add_attribute("validator", validator)
                    .add_attribute("amount", amount_value)
                    .add_attribute("new_shares", resp.amount.amount.to_string()),
            StakingOp::Undelegate { validator } => {
                let date = OffsetDateTime::now_utc().format(&Rfc3339).unwrap();

                Event::new("unbond")
                    .add_attribute("validator", validator)
                    .add_attribute("amount", amount_value)
                    .add_attribute("completion_time", date)
            }
            StakingOp::Redelegate { src_validator, dst_validator } =>
                Event::new("redelegate")
                    .add_attribute("source_validator", src_validator)
                    .add_attribute("destination_validator", dst_validator)
                    .add_attribute("amount", amount_value)
        };

        Self(vec![event])
    }
}

#[cfg(feature = "ensemble-staking")]
impl From<&DistributionResponse> for ProcessedEvents {
    fn from(resp: &DistributionResponse) -> Self {
        let event = match &resp.kind {
            DistributionOp::WithdrawDelegatorReward { reward, validator } =>
                Event::new("withdraw_delegator_reward")
                    .add_attribute("validator", validator)
                    .add_attribute("sender", &resp.sender)
                    .add_attribute(
                        "amount",
                        format!("{}{}", reward.amount, reward.denom),
                    ),
            _ => todo!()
        };

        Self(vec![event])
    }
}

fn process_wasm_response(
    response: &Response,
    address: String,
    event: Event
) -> ProcessedEvents {
    let attributes = if response.attributes.is_empty() {
        0
    } else {
        1
    };

    let mut events = Vec::with_capacity(response.events.len() + attributes + 1);
    events.push(event);

    // Response::add_atrribute/s creates a new event in the array where
    // the type is "wasm" and inserts them under it. And attribute with key 
    // "contract_address" is also inserted.
    if !response.attributes.is_empty() {
        // Attributes are inserted in LIFO order i.e in reverse.
        events.push(Event::new("wasm")
            .add_attributes(response.attributes.clone().into_iter().rev())
            .add_attribute(CONTRACT_ATTR, &address)
        );
    }

    // Response::add_event/s creates a new event in the array where
    // the type is prefixed with "wasm-". And attribute with key 
    // "contract_address" is also inserted.
    let wasm_events = response.events.clone().into_iter().map(|mut x| {
        x.ty = format!("wasm-{}", x.ty);
        x.attributes.insert(
            0,
            Attribute {
                key: CONTRACT_ATTR.into(),
                value: address.clone(),
                encrypted: true
            }
        );

        x
    });

    events.extend(wasm_events);

    ProcessedEvents(events)
}

// Taken from https://github.com/CosmWasm/cw-multi-test/blob/03026ccd626f57869c57c9192a03da6625e4791d/src/wasm.rs#L231-L268
fn validate_response(response: &Response) -> EnsembleResult<()> {
    validate_attributes(&response.attributes)?;

    for event in &response.events {
        validate_attributes(&event.attributes)?;
        let ty = event.ty.trim();
        
        if ty.len() < 2 {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute type cannot be less than 2 characters: {}", ty)
            ));
        }
    }

    Ok(())
}

fn validate_attributes(attributes: &[Attribute]) -> EnsembleResult<()> {
    for attr in attributes {
        let key = attr.key.trim();
        let val = attr.value.trim();

        if key.is_empty() {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute key for value {} cannot be empty", val)
            ));
        }

        if val.is_empty() {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute value with key {} cannot be empty", key)
            ));
        }

        if key.starts_with('_') {
            return Err(EnsembleError::AttributeValidation(
                format!("Attribute key {} cannot start with \"_\"", key)
            ));
        }
    }

    Ok(())
}

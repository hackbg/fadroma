use crate::*;

#[inline]
pub fn populate (object: &Object, fields: &[(JsValue, JsValue)]) -> Result<(), Error> {
    for (key, val) in fields.iter() {
        Reflect::set(&object, &key.into(), &val.into())?;
    }
    Ok(())
}

#[inline]
pub fn object (fields: &[(JsValue, JsValue)]) -> Result<Object, Error> {
    let object = Object::new();
    populate(&object, fields)?;
    Ok(object)
}

#[inline]
pub fn to_bytes (source: &Uint8Array) -> Vec<u8> {
    let mut bytes: Vec<u8> = vec![0u8; source.length() as usize];
    source.copy_to(&mut bytes);
    bytes
}

#[inline]
pub fn to_hex (source: &mut impl std::io::Write) -> Result<String, Error> {
    let mut output = vec![];
    source.write(&mut output)
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(hex::encode_upper(&output))
}

#[inline]
pub fn to_hex_borsh (source: &impl BorshSerialize) -> Result<String, Error> {
    let mut output = vec![];
    source.serialize(&mut output)
        .map_err(|e|Error::new(&format!("{e}")))?;
    Ok(hex::encode_upper(&output))
}

pub trait ToJS {
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

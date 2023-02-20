use serde::{Serialize, de::DeserializeOwned};

use crate::cosmwasm_std::{to_vec, from_slice};
use super::{FadromaSerialize, FadromaDeserialize, Serializer, Deserializer, Result, Error};

/// A wrapper that allows serializing types that only
/// implement CWs serialization traits. It simply uses
/// CWs facilities to convert to JSON text bytes which
/// Fadroma's binary serialization understands.
///
/// By using this you are effectively **bypassing** Fadroma's
/// binary serialization benefits. As such, you probably don't
/// want to use it outside of testing...
#[derive(Clone, PartialEq, Debug)]
pub struct SerdeAdapter<T: Serialize + DeserializeOwned>(pub T);

impl<T: Serialize + DeserializeOwned> FadromaSerialize for SerdeAdapter<T> {
    #[inline]
    fn size_hint(&self) -> usize {
        64
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let json = to_vec(&self.0).map_err(|_| Error::InvalidType)?;
        ser.write(&json);

        Ok(())
    }
}

impl<T: Serialize + DeserializeOwned> FadromaDeserialize for SerdeAdapter<T> {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let bytes = de.read(de.len())?;
        let result = from_slice::<T>(bytes).map_err(|_| Error::InvalidType)?;

        Ok(Self(result))
    }
}

impl<T: Serialize + DeserializeOwned> From<T> for SerdeAdapter<T> {
    #[inline]
    fn from(item: T) -> Self {
        Self(item)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        cosmwasm_std::{SubMsg, Empty, BankMsg, BankQuery, coin},
        bin_serde::testing::serde
    };

    #[test]
    fn serde_adapter() {
        let msg: SubMsg<Empty> = SubMsg::reply_on_error(
            BankMsg::Burn {
                amount: vec![coin(100, "ucosm")]
            },
            3
        );
        serde(&SerdeAdapter(msg.clone()));

        let query = BankQuery::Balance {
            address: "address".into(),
            denom: "ucosm".into()
        };
        serde(&SerdeAdapter(query));
    }
}

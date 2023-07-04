use crate::cosmwasm_std::{Binary, CanonicalAddr, Addr, Coin, Empty};

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, ByteLen
};

impl FadromaSerialize for Binary {
    #[inline]
    fn size_hint(&self) -> usize {
        ByteLen::MAX_SIZE + self.len()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let len = ByteLen::encode(self.len())?;
        ser.write(len.as_bytes());
        ser.write(&self);

        Ok(())
    }
}

impl FadromaDeserialize for Binary {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let len = ByteLen::decode(de)?;
        let bytes = de.read(len)?;

        Ok(Self(Vec::from(bytes)))
    }
}

impl FadromaSerialize for CanonicalAddr {
    #[inline]
    fn size_hint(&self) -> usize {
        FadromaSerialize::size_hint(&self.0)
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        FadromaSerialize::to_bytes(&self.0, ser)
    }
}

impl FadromaDeserialize for CanonicalAddr {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let addr = Binary::from_bytes(de)?;

        Ok(Self(addr))
    }
}

impl FadromaSerialize for Addr {
    #[inline]
    fn size_hint(&self) -> usize {
        FadromaSerialize::size_hint(self.as_str())
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        FadromaSerialize::to_bytes(self.as_str(), ser)
    }
}

impl FadromaDeserialize for Addr {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let addr = String::from_bytes(de)?;

        Ok(Self::unchecked(addr))
    }
}

impl FadromaSerialize for Coin {
    #[inline]
    fn size_hint(&self) -> usize {
        FadromaSerialize::size_hint(&self.denom) +
            FadromaSerialize::size_hint(&self.amount)
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        FadromaSerialize::to_bytes(&self.denom, ser)?;

        FadromaSerialize::to_bytes(&self.amount, ser)
    }
}

impl FadromaDeserialize for Coin {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        Ok(Self {
            denom: de.deserialize()?,
            amount: de.deserialize()?
        })
    }
}

impl FadromaSerialize for Empty {
    #[inline]
    fn size_hint(&self) -> usize {
        0
    }

    #[inline]
    fn to_bytes(&self, _ser: &mut Serializer) -> Result<()> {
        Ok(())
    }
}

impl FadromaDeserialize for Empty {
    #[inline]
    fn from_bytes(_de: &mut Deserializer) -> Result<Self> {
        Ok(Self { })
    }
}

#[cfg(test)]
mod tests {
    use proptest::{
        prelude::*,
        num,
        collection::vec
    };

    use crate::{
        cosmwasm_std::Uint128,
        bin_serde::testing::{serde_len, proptest_serde_len, proptest_serde}
    };
    use super::*;

    #[test]
    fn serde_binary() {
        let binary = Binary(vec![13u8; 127]);
        serde_len(&binary, 128);

        let addr = CanonicalAddr(binary);
        serde_len(&addr, 128);

        let binary = Binary(vec![33u8; 16384]);
        serde_len(&binary, 16387);
    }

    proptest! {
        #[test]
        fn proptest_serde_binary(bytes in vec(num::u8::ANY, 0..=1024)) {
            let len = ByteLen::encode(bytes.len()).unwrap();
            let byte_len = bytes.len();

            proptest_serde_len(&Binary(bytes), len.size() + byte_len)?;
        }

        #[test]
        fn proptest_serde_canonical_addr(bytes in vec(num::u8::ANY, 0..=1024)) {
            let len = ByteLen::encode(bytes.len()).unwrap();
            let byte_len = bytes.len();

            proptest_serde_len(
                &CanonicalAddr(Binary(bytes)),
                len.size() + byte_len
            )?;
        }

        #[test]
        fn proptest_serde_addr(string in "\\PC*") {
            let len = ByteLen::encode(string.len()).unwrap();
            let byte_len = string.len();

            proptest_serde_len(
                &Addr::unchecked(string),
                len.size() + byte_len
            )?;
        }

        #[test]
        fn proptest_serde_coin(denom in "\\PC*", amount in 064..u64::MAX) {
            let coin = Coin {
                denom,
                amount: Uint128::new(amount as u128)
            };

            proptest_serde(&coin)?;
        }
    }
}

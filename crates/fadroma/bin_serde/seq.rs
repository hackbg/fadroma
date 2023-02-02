use crate::cosmwasm_std::Binary;

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, ByteLen
};

impl FadromaSerialize for &[u8] {
    #[inline]
    fn size(&self) -> usize {
        ByteLen::MAX_SIZE + self.len()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let len = ByteLen::encode(self.len())?;
        ser.write(len.as_bytes());
        ser.write(self);

        Ok(())
    }
}

impl FadromaSerialize for &str {
    #[inline]
    fn size(&self) -> usize {
        ByteLen::MAX_SIZE + self.len()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let len = ByteLen::encode(self.len())?;
        ser.write(len.as_bytes());
        ser.write(self.as_bytes());

        Ok(())
    }
}

impl FadromaSerialize for String {
    #[inline]
    fn size(&self) -> usize {
        FadromaSerialize::size(&self.as_str())
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        FadromaSerialize::to_bytes(&self.as_str(), ser)
    }
}

impl FadromaDeserialize for String {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let len = ByteLen::decode(de)?;
        let bytes = de.read(len)?;

        let result = unsafe {
            String::from_utf8_unchecked(bytes.into())
        };

        Ok(result)
    }
}

impl FadromaSerialize for Binary {
    #[inline]
    fn size(&self) -> usize {
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
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let len = ByteLen::decode(de)?;
        let bytes = de.read(len)?;

        Ok(Self(Vec::from(bytes)))
    }
}

use std::mem;

use crate::cosmwasm_std::{Binary, CanonicalAddr, Addr};

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, ByteLen
};

impl<T: FadromaSerialize> FadromaSerialize for Vec<T> {
    #[inline]
    fn size_hint(&self) -> usize {
        let size = if mem::needs_drop::<T>() {
            self.iter().map(|x| x.size_hint()).sum()
        } else {
            self.len() * mem::size_of::<T>()
        };

        ByteLen::MAX_SIZE + size
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let len = ByteLen::encode(self.len())?;
        ser.write(len.as_bytes());

        if self.len() == 0 {
            return Ok(());
        }

        for item in self {
            item.to_bytes(ser)?;
        }

        Ok(())
    }
}

impl<T: FadromaDeserialize> FadromaDeserialize for Vec<T> {
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let len = ByteLen::decode(de)?;

        if len == 0 {
            return Ok(Self::new());
        }

        let mut result = Vec::with_capacity(len);

        for _ in 0..len {
            result.push(T::from_bytes(de)?);
        }

        Ok(result)
    }
}

impl FadromaSerialize for [u8] {
    #[inline]
    fn size_hint(&self) -> usize {
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

impl FadromaSerialize for str {
    #[inline]
    fn size_hint(&self) -> usize {
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
    fn size_hint(&self) -> usize {
        FadromaSerialize::size_hint(self.as_str())
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        FadromaSerialize::to_bytes(self.as_str(), ser)
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
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
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
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
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
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let addr = String::from_bytes(de)?;

        Ok(Self::unchecked(addr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bin_serde::{
        FadromaSerialize, Serializer, Deserializer,
        testing::serde_len
    };

    #[test]
    fn serde_byte_slice() {
        let slice: &[u8] = &[];

        let mut ser = Serializer::with_capacity(1);
        FadromaSerialize::to_bytes(slice, &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 1);

        let deserialized = Deserializer::from(ser.finish())
            .deserialize::<Vec<u8>>()
            .unwrap();

        assert_eq!(deserialized, Vec::<u8>::new());
        serde_len(&Vec::<u8>::new(), 1);

        let bytes = [33u8; 127];

        let mut ser = Serializer::with_capacity(128);
        FadromaSerialize::to_bytes(bytes.as_slice(), &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 128);

        let deserialized = Deserializer::from(ser.finish())
            .deserialize::<Vec<u8>>()
            .unwrap();

        assert_eq!(deserialized, bytes.as_slice());

        let bytes = [33u8; 128];

        let mut ser = Serializer::with_capacity(130);
        FadromaSerialize::to_bytes(bytes.as_slice(), &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 130);

        let deserialized = Deserializer::from(ser.finish())
            .deserialize::<Vec<u8>>()
            .unwrap();

        assert_eq!(deserialized, bytes.as_slice());
    }

    #[test]
    fn serde_string() {
        let slice: &str = "";
        
        let mut ser = Serializer::with_capacity(1);
        FadromaSerialize::to_bytes(slice, &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 1);

        let deserialized = Deserializer::from(ser.finish())
            .deserialize::<String>()
            .unwrap();

        assert_eq!(deserialized, String::new());
        serde_len(&String::new(), 1);

        let mut string = String::with_capacity(128);

        for i in 0u8..127u8 {
            string.push(i as char);
        }

        let mut ser = Serializer::with_capacity(127);
        FadromaSerialize::to_bytes(string.as_str(), &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 128);

        let deserialized = Deserializer::from(ser.finish())
            .deserialize::<String>()
            .unwrap();

        assert_eq!(deserialized, string);

        string.push('W');
        serde_len(&string, 130);

        let addr = Addr::unchecked(string);
        serde_len(&addr, 130);
    }

    #[test]
    fn serde_binary() {
        let binary = Binary(vec![13u8; 127]);
        serde_len(&binary, 128);

        let addr = CanonicalAddr(binary);
        serde_len(&addr, 128);

        let binary = Binary(vec![33u8; 16384]);
        serde_len(&binary, 16387);
    }
}

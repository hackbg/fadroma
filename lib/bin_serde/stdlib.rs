use std::{mem, ptr};

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, Error,
    ByteLen
};

impl<T: FadromaSerialize> FadromaSerialize for Option<T> {
    #[inline]
    fn size_hint(&self) -> usize {
        1 + match self {
            None => 0,
            Some(x) => x.size_hint()
        }
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        match self {
            None => {
                ser.write_byte(0);
                Ok(())
            }
            Some(x) => {
                ser.write_byte(1);
                x.to_bytes(ser)
            }
        }
    }
}

impl<T: FadromaDeserialize> FadromaDeserialize for Option<T> {
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let tag = de.read_byte()?;

        match tag {
            0 => Ok(None),
            1 => Ok(Some(T::from_bytes(de)?)),
            _ => Err(Error::InvalidType)
        }
    }
}

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
    #[inline]
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
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
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let len = ByteLen::decode(de)?;
        let bytes = de.read(len)?;

        let result = unsafe {
            String::from_utf8_unchecked(bytes.into())
        };

        Ok(result)
    }
}

impl<const N: usize> FadromaSerialize for [u8; N] {
    #[inline]
    fn size_hint(&self) -> usize {
        ByteLen::MAX_SIZE + N
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        let len = ByteLen::encode(self.len())?;
        ser.write(len.as_bytes());
        ser.write(self.as_slice());

        Ok(())
    }
}

impl<const N: usize> FadromaDeserialize for [u8; N] {
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self> {
        let len = ByteLen::decode(de)?;
        let bytes = de.read(len)?;

        let mut result = [0; N];

        unsafe {
            // SAFETY: `read` will either return the requested amount of bytes
            // or an error. The slices cannot overlap because the read bytes come from
            // heap memory.
            ptr::copy_nonoverlapping(
                bytes.as_ptr(),
                result.as_mut_ptr(),
                N
            )
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use proptest::{
        prelude::*,
        num,
        collection::vec,
        array::{uniform7, uniform13, uniform27}
    };

    use crate::bin_serde::{
        FadromaSerialize, Serializer, Deserializer,
        testing::{serde_len, proptest_serde_len}
    };
    use super::*;

    #[test]
    fn serde_option() {
        serde_len(&Some(String::from("option")), 8);
        serde_len::<Option<String>>(&None, 1);

        serde_len(&Some(257u64), 4);
        serde_len::<Option<u64>>(&None, 1);
    }

    #[test]
    fn serde_byte_slice() {
        let slice: &[u8] = &[];

        let mut ser = Serializer::with_capacity(1);
        FadromaSerialize::to_bytes(slice, &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 1);
        assert_eq!(ser.buf[0], 0);

        let deserialized = Deserializer::from(&ser.finish())
            .deserialize::<Vec<u8>>()
            .unwrap();

        assert_eq!(deserialized, Vec::<u8>::new());
        serde_len(&Vec::<u8>::new(), 1);

        let bytes = [33u8; 127];

        let mut ser = Serializer::with_capacity(128);
        FadromaSerialize::to_bytes(bytes.as_slice(), &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 128);

        let deserialized = Deserializer::from(&ser.finish())
            .deserialize::<Vec<u8>>()
            .unwrap();

        assert_eq!(deserialized, bytes.as_slice());

        let bytes = [33u8; 128];

        let mut ser = Serializer::with_capacity(130);
        FadromaSerialize::to_bytes(bytes.as_slice(), &mut ser).unwrap();
        assert_eq!(ser.buf.len(), 130);

        let deserialized = Deserializer::from(&ser.finish())
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

        let deserialized = Deserializer::from(&ser.finish())
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

        let deserialized = Deserializer::from(&ser.finish())
            .deserialize::<String>()
            .unwrap();

        assert_eq!(deserialized, string);

        string.push('W');
        serde_len(&string, 130);
    }

    proptest! {
        #[test]
        fn proptest_serde_byte_slice(bytes in vec(num::u8::ANY, 0..=1024)) {
            let len = ByteLen::encode(bytes.len()).unwrap();

            let mut ser = Serializer::with_capacity(len.size() + bytes.len());
            FadromaSerialize::to_bytes(bytes.as_slice(), &mut ser).unwrap();

            let serialized_bytes = ser.finish();
            prop_assert_eq!(serialized_bytes.len(), len.size() + bytes.len());

            let mut de = Deserializer::from(&serialized_bytes);
            let result: Vec<u8> = de.deserialize().unwrap();
            prop_assert_eq!(de.is_finished(), true);

            prop_assert_eq!(result, bytes);
        }

        #[test]
        fn proptest_serde_str(string in "\\PC*") {
            let len = ByteLen::encode(string.len()).unwrap();

            let mut ser = Serializer::with_capacity(len.size() + string.len());
            FadromaSerialize::to_bytes(string.as_bytes(), &mut ser).unwrap();

            let serialized_bytes = ser.finish();
            prop_assert_eq!(serialized_bytes.len(), len.size() + string.len());

            let mut de = Deserializer::from(&serialized_bytes);
            let result: String = de.deserialize().unwrap();
            prop_assert_eq!(de.is_finished(), true);

            prop_assert_eq!(result, string);
        }

        #[test]
        fn proptest_serde_string(string in "\\PC*") {
            let len = ByteLen::encode(string.len()).unwrap();
            proptest_serde_len(&string, len.size() + string.len())?;
        }

        #[test]
        fn proptest_serde_vec_string(vec in vec("\\PC*", 0..=100)) {
            let vec_byte_len = ByteLen::encode(vec.len()).unwrap();
            let mut byte_len = vec_byte_len.size();

            for s in &vec {
                let len = ByteLen::encode(s.len()).unwrap();
                byte_len += len.size() + s.len();
            }

            proptest_serde_len(&vec, byte_len)?;
        }

        #[test]
        fn proptest_serde_array7(bytes in uniform7(0..u8::MAX)) {
            proptest_serde_len(&bytes, 1 + 7)?;
        }

        #[test]
        fn proptest_serde_array13(bytes in uniform13(0..u8::MAX)) {
            proptest_serde_len(&bytes, 1 + 13)?;
        }

        #[test]
        fn proptest_serde_array27(bytes in uniform27(0..u8::MAX)) {
            proptest_serde_len(&bytes, 1 + 27)?;
        }
    }
}

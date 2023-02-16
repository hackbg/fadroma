use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, Error
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
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let tag = de.read_byte()?;

        match tag {
            0 => Ok(None),
            1 => Ok(Some(T::from_bytes(de)?)),
            _ => Err(Error::InvalidType)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::bin_serde::testing::serde_len;

    #[test]
    fn serde_option() {
        serde_len(&Some(String::from("option")), 8);
        serde_len::<Option<String>>(&None, 1);

        serde_len(&Some(257u64), 4);
        serde_len::<Option<u64>>(&None, 1);
    }
}

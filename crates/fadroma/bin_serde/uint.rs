use std::{mem, ptr};

use crate::cosmwasm_std::{Uint64, Uint128,Uint256, Uint512, Decimal, Decimal256};

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, Error
};

impl FadromaSerialize for u8 {
    #[inline]
    fn size_hint(&self) -> usize {
        1
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        Ok(ser.write_byte(*self))
    }
}

impl FadromaDeserialize for u8 {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        de.read_byte()
    }
}

impl FadromaSerialize for bool {
    #[inline]
    fn size_hint(&self) -> usize {
        1
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        Ok(ser.write_byte(*self as u8))
    }
}

impl FadromaDeserialize for bool {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        match de.read_byte()? {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(Error::InvalidType)
        }
    }
}

impl FadromaSerialize for u16 {
    #[inline]
    fn size_hint(&self) -> usize {
        2
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        Ok(ser.write(&self.to_le_bytes()))
    }
}

impl FadromaDeserialize for u16 {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        const SIZE: usize = mem::size_of::<u16>();
        let le_bytes = de.read(SIZE)?;

        Ok(Self::from_le_bytes([le_bytes[0], le_bytes[1]]))
    }
}

macro_rules! impl_uint {
    ($int:ty) => {
        impl_uint!($int, Self::MIN);
    };

    // TODO: this can go when scrt CW gets updated to the newest version.
    ($int:ty, $zero:expr) => {
        impl FadromaSerialize for $int {
            #[inline]
            fn size_hint(&self) -> usize {
                mem::size_of::<Self>()
            }
        
            #[inline]
            fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
                let bytes = self.to_le_bytes();
                let mut len = bytes.len();
        
                while len > 0 && bytes[len - 1] == 0 {
                    len -= 1;
                }
        
                ser.write_byte(len as u8);
        
                if len > 0 {
                    ser.write(&bytes[0..len]);
                }

                Ok(())
            }
        }

        impl FadromaDeserialize for $int {
            #[inline]
            fn from_bytes(de: &mut Deserializer) -> Result<Self> {
                let len = de.read_byte()? as usize;
        
                let value = if len > 0 {
                    const SIZE: usize = mem::size_of::<$int>();
                    let mut buf = [0; SIZE];
        
                    let le_bytes = de.read(len)?;
        
                    // SAFETY: `read` will either return the requested amount of bytes
                    // or an error. The slices cannot overlap because the read bytes come from
                    // heap memory.
                    unsafe {
                        ptr::copy_nonoverlapping(le_bytes.as_ptr(), buf.as_mut_ptr(), len);
                    }
        
                    Self::from_le_bytes(buf)
                } else {
                    $zero
                };
        
                Ok(value)
            }
        }
    };
}

impl_uint!(u32);
impl_uint!(u64);
impl_uint!(u128);
impl_uint!(Uint256, Self::zero());
impl_uint!(Uint512, Self::zero());

impl FadromaSerialize for Uint64 {
    #[inline]
    fn size_hint(&self) -> usize {
        mem::size_of::<Self>()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.u64().to_bytes(ser)
    }
}

impl FadromaDeserialize for Uint64 {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let value = de.deserialize::<u64>()?;

        Ok(Self::from(value))
    }
}

impl FadromaSerialize for Uint128 {
    #[inline]
    fn size_hint(&self) -> usize {
        mem::size_of::<Self>()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.u128().to_bytes(ser)
    }
}

impl FadromaDeserialize for Uint128 {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let value = de.deserialize::<u128>()?;

        Ok(Self::from(value))
    }
}

impl FadromaSerialize for Decimal {
    #[inline]
    fn size_hint(&self) -> usize {
        mem::size_of::<Self>()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.atomics().u128().to_bytes(ser)
    }
}

impl FadromaDeserialize for Decimal {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let value = de.deserialize::<u128>()?;

        Ok(Self::raw(value))
    }
}

impl FadromaSerialize for Decimal256 {
    #[inline]
    fn size_hint(&self) -> usize {
        mem::size_of::<Self>()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.atomics().to_bytes(ser)
    }
}

impl FadromaDeserialize for Decimal256 {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        let value = de.deserialize::<Uint256>()?;

        Ok(Self::new(value))
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use super::*;
    use crate::bin_serde::testing::{serde, serde_len};

    // This makes sure that if the underlying representation
    // of the CW uints changes, we get notified about it.
    #[test]
    fn cw_uint_sizes() {
        assert_eq!(mem::size_of::<Uint64>(), 8);
        assert_eq!(mem::size_of::<Uint128>(), 16);
        assert_eq!(mem::size_of::<Uint256>(), 32);
        assert_eq!(mem::size_of::<Uint512>(), 64);
        assert_eq!(mem::size_of::<Decimal>(), 16);
        assert_eq!(mem::size_of::<Decimal256>(), 32);
    }

    #[test]
    fn serde_u8() {
        serde(&0u8);
        serde(&10u8);
        serde(&100u8);
        serde(&u8::MAX);
    }

    #[test]
    fn serde_bool() {
        serde_len(&true, 1);
        serde_len(&false, 1);

        let mut de = Deserializer::from(vec![2]);
        let err = de.deserialize::<bool>().unwrap_err();
        assert_eq!(err, Error::InvalidType);
    }

    #[test]
    fn serde_u16() {
        serde_len(&0u16, 2);
        serde_len(&0xFFu16, 2);
        serde_len(&0x100u16, 2);
        serde_len(&u16::MAX, 2);
    }

    #[test]
    fn serde_u32() {
        serde_len(&0u32, 1);

        let mut num = 1u32;

        for i in 3..6 {
            num <<= 8;
            serde_len(&num, i);
            serde_len(&(num - 1), i - 1);
        }

        serde_len(&u32::MAX, 5);
    }

    #[test]
    fn serde_u64() {
        serde_len(&0u64, 1);

        let mut num = 1u64;

        for i in 3..10 {
            num <<= 8;
            serde_len(&num, i);
            serde_len(&(num - 1), i - 1);
        }

        serde_len(&u64::MAX, 9);
    }

    #[test]
    fn serde_u128() {
        serde_len(&0u128, 1);

        let mut num = 1u128;

        for i in 3..18 {
            num <<= 8;
            serde_len(&num, i);
            serde_len(&(num - 1), i - 1);
        }

        serde_len(&u128::MAX, 17);
    }

    #[test]
    fn serde_uint64() {
        serde_len(&Uint64::zero(), 1);
        serde_len(&Uint64::MAX, 9);
    }

    #[test]
    fn serde_uint128() {
        serde_len(&Uint128::zero(), 1);
        serde_len(&Uint128::MAX, 17);
    }

    #[test]
    fn serde_uint256() {
        serde_len(&Uint256::zero(), 1);

        for i in 0..32 {
            let mut bytes = [0u8; 32];
            bytes[i] = 1;

            let num = Uint256::from_le_bytes(bytes);
            serde_len(&num, i + 2);

            if i > 0 {
                let mut bytes = [0u8; 32];

                for j in 0..i {
                    bytes[j] = 0xFF;
                }
    
                let num = Uint256::from_le_bytes(bytes);
                serde_len(&num, i + 1);
            }
        }
    }

    #[test]
    fn serde_uint512() {
        serde_len(&Uint512::zero(), 1);

        for i in 0..64 {
            let mut bytes = [0u8; 64];
            bytes[i] = 1;

            let num = Uint512::from_le_bytes(bytes);
            serde_len(&num, i + 2);

            if i > 0 {
                let mut bytes = [0u8; 64];

                for j in 0..i {
                    bytes[j] = 0xFF;
                }
    
                let num = Uint512::from_le_bytes(bytes);
                serde_len(&num, i + 1);
            }
        }
    }

    #[test]
    fn serde_decimal128() {
        let num = Decimal::from_str("1.5").unwrap();
        serde_len(&num, 9);

        let num = Decimal::from_str("123.321").unwrap();
        serde_len(&num, 10);

        serde_len(&Decimal::MAX, 17);
    }

    #[test]
    fn serde_decimal256() {
        let num = Decimal256::from_str("123.321").unwrap();
        serde_len(&num, 10);

        let num = Decimal256::from_str("123456789.987654321").unwrap();
        serde_len(&num, 12);

        serde_len(&Decimal256::MAX, 33);
    }
}

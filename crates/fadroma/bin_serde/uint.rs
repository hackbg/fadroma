use std::{mem, ptr};

use crate::cosmwasm_std::{Uint64, Uint128,Uint256, Uint512};

use super::{
    FadromaSerialize, FadromaDeserialize,
    Serializer, Deserializer, Result, Error
};

impl FadromaSerialize for u8 {
    #[inline]
    fn size(&self) -> usize {
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
    fn size(&self) -> usize {
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
    fn size(&self) -> usize {
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
        let mut buf = [0; SIZE];

        // SAFETY: `read_bytes` will either return the requested amount of bytes
        // or an error. The slices cannot overlap because the read bytes come from
        // heap memory.
        unsafe {
            ptr::copy_nonoverlapping(le_bytes.as_ptr(), buf.as_mut_ptr(), SIZE);
        }

        Ok(Self::from_le_bytes(buf))
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
            fn size(&self) -> usize {
                mem::size_of::<Self>()
            }
        
            #[inline]
            fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
                let bytes = self.to_le_bytes();
                let mut len = bytes.len();
        
                while bytes[len] == 0 && len > 0 {
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
        
                    // SAFETY: `read_bytes` will either return the requested amount of bytes
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
    fn size(&self) -> usize {
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
    fn size(&self) -> usize {
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

#[cfg(test)]
mod tests {
    use super::*;

    // This makes sure that if the underlying representation
    // of the CW uints changes, we get notified about it.
    #[test]
    fn cw_uint_sizes() {
        assert_eq!(mem::size_of::<Uint64>(), 8);
        assert_eq!(mem::size_of::<Uint128>(), 16);
        assert_eq!(mem::size_of::<Uint256>(), 32);
        assert_eq!(mem::size_of::<Uint512>(), 64);
    }
}

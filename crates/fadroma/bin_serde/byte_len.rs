use super::{Result, Error, Deserializer};

/// Used to encode the number of items that a sequence type
/// (such as [`String::len`] or a [`Vec::len`]) has. This allows us
/// to represent that length with as few bytes as possible
/// while allowing it to be dynamic.
#[derive(Clone, Copy, Debug)]
pub struct ByteLen {
    len: u8,
    bytes: [u8; 4]
}

impl ByteLen {
    // We can increase that max by skipping the encoding on the last
    // byte, however the current max is already unreasonable in practice.

    pub const MAX: u32 = u32::from_le_bytes([0xFF, 0xFF, 0xFF, 0x0F]);

    /// The maximum size in bytes.
    pub const MAX_SIZE: usize = 4;

    /// Encodes the given length as bytes to be serialized.
    /// Returns an [`Error::ByteLenTooLong`] if the length
    /// is bigger than [`ByteLen::MAX`].
    pub fn encode(len: usize) -> Result<Self> {
        if len > Self::MAX as usize {
            return Err(Error::ByteLenTooLong { len });
        }

        let mut len = len as u32;
        let mut i = 0;
        let mut bytes = [0u8; 4];

        while len >= 0x80 {
            bytes[i] = (len | 0x80) as u8;
            len >>= 7;
            i += 1;
        }

        bytes[i] = len as u8;

        Ok(Self {
            len: (i + 1) as u8,
            bytes
        })
    }

    /// The raw bytes the represent the encoded length.
    /// The size of the slice is always between 1 and [`ByteLen::MAX_SIZE`].
    #[inline]
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[0..self.len as usize]
    }

    /// The size in bytes of the encoded length.
    /// Is always between 1 and [`ByteLen::MAX_SIZE`].
    #[inline]
    pub fn size(&self) -> usize {
        self.len as usize
    }

    /// Decodes a length from a sequence of bytes as a `usize`.
    /// It relies on the bytes to have previously been encoded
    /// using [`ByteLen::encode`] and for the given [`Deserializer`]
    /// to be at the correct position at which those were written before.
    /// It is up to the implementor to ensure that these invariants hold true.
    pub fn decode(de: &mut Deserializer) -> Result<usize> {
        let mut result = 0u32;
        let mut shift = 0u32;

        loop {
            let byte = de.read_byte()?;
            result |= ((byte & 0x7F) as u32) << shift;
            shift += 7;

            if (byte & 0x80) == 0 {
                break;
            }
        }

        Ok(result as usize)
    }
}

impl AsRef<[u8]> for ByteLen {
    #[inline]
    fn as_ref(&self) -> &[u8] {
        self.as_bytes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /* This test takes too long to run. Can be used if the implementation changes.
    #[test]
    fn all_possible_inputs() {
        for i in 0..ByteLen::MAX {
            let encoded = ByteLen::encode(i as usize).unwrap();

            let mut de = Deserializer::from(Vec::from(encoded.as_bytes()));
            let len = ByteLen::decode(&mut de).unwrap();

            assert!(de.is_finished());
            assert_eq!(len as u32, i);
        }
    }
    */

    #[test]
    fn byte_len() {
        let len = ByteLen::encode(0).unwrap();
        assert_eq!(len.size(), 1);
        assert_eq!(len.as_bytes().len(), 1);
        assert_eq!(len.as_bytes(), &[0]);

        let len = ByteLen::encode(127).unwrap();
        assert_eq!(len.size(), 1);
        assert_eq!(len.as_bytes().len(), 1);
        assert_eq!(len.as_bytes(), &[127]);

        let len = ByteLen::encode(128).unwrap();
        assert_eq!(len.size(), 2);
        assert_eq!(len.as_bytes().len(), 2);
        assert_eq!(len.as_bytes()[1] & 0x80, 0);

        let len = ByteLen::encode(16383).unwrap();
        assert_eq!(len.size(), 2);
        assert_eq!(len.as_bytes().len(), 2);
        assert_eq!(len.as_bytes()[1] & 0x80, 0);

        let len = ByteLen::encode(16384).unwrap();
        assert_eq!(len.size(), 3);
        assert_eq!(len.as_bytes().len(), 3);
        assert_eq!(len.as_bytes()[2] & 0x80, 0);

        let len = ByteLen::encode(2097151).unwrap();
        assert_eq!(len.size(), 3);
        assert_eq!(len.as_bytes().len(), 3);
        assert_eq!(len.as_bytes()[2] & 0x80, 0);

        let len = ByteLen::encode(2097152).unwrap();
        assert_eq!(len.size(), 4);
        assert_eq!(len.as_bytes().len(), 4);
        assert_eq!(len.as_bytes()[3] & 0x80, 0);

        let len = ByteLen::encode(ByteLen::MAX as usize).unwrap();
        assert_eq!(len.size(), 4);
        assert_eq!(len.as_bytes().len(), 4);
        assert_eq!(len.as_bytes()[3] & 0x80, 0);

        let err = ByteLen::encode((ByteLen::MAX + 1) as usize).unwrap_err();
        assert!(matches!(err, Error::ByteLenTooLong { .. }));
    }
}

use super::{Result, Error, Deserializer};

#[derive(Debug)]
pub struct ByteLen {
    len: u8,
    bytes: [u8; 4]
}

impl ByteLen {
    // We can increase that max by skipping the encoding on the last
    // byte, however the current max is already unreasonable in practice.

    /// ~268MB
    pub const MAX: u32 = u32::from_le_bytes([0xFF, 0xFF, 0xFF, 0x0F]);

    /// The maximum size in bytes.
    pub const MAX_SIZE: usize = 4;

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

    #[inline]
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[0..self.len as usize]
    }

    #[inline]
    pub fn size(&self) -> usize {
        self.len as usize
    }

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
        let len = ByteLen::encode(127).unwrap();
        assert_eq!(len.size(), 1);

        let len = ByteLen::encode(128).unwrap();
        assert_eq!(len.size(), 2);

        let len = ByteLen::encode(16383).unwrap();
        assert_eq!(len.size(), 2);

        let len = ByteLen::encode(16384).unwrap();
        assert_eq!(len.size(), 3);

        let len = ByteLen::encode(2097151).unwrap();
        assert_eq!(len.size(), 3);

        let len = ByteLen::encode(2097152).unwrap();
        assert_eq!(len.size(), 4);

        let len = ByteLen::encode(ByteLen::MAX as usize).unwrap();
        assert_eq!(len.size(), 4);

        let err = ByteLen::encode((ByteLen::MAX + 1) as usize).unwrap_err();
        assert!(matches!(err, Error::ByteLenTooLong { .. }));
    }
}

mod byte_len;
mod uint;
mod seq;

use std::ptr;

pub use byte_len::ByteLen;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(PartialEq, Debug)]
pub enum Error {
    EndOfStream {
        total: usize,
        read: usize,
        requested: usize
    },
    ByteLenTooLong {
        len: usize
    },
    InvalidType
}

pub trait FadromaSerialize {
    fn size_hint(&self) -> usize;
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()>;
}

pub trait FadromaDeserialize: Sized {
    fn from_bytes(de: &mut Deserializer) -> Result<Self>;
}

pub trait FadromaSerializeExt: FadromaSerialize {
    fn serialize(&self) -> Result<Vec<u8>>;
}

#[derive(Clone, Debug)]
pub struct Serializer {
    buf: SmallVec<{Self::STATIC_LEN}>
}

#[derive(Clone, Debug)]
pub struct Deserializer {
    read: usize,
    bytes: Vec<u8>
}

#[derive(Clone, Debug)]
enum SmallVec<const N: usize> {
    Array {
        index: usize,
        buf:[u8; N]
    },
    Vec(Vec<u8>)
}

impl Serializer {
    pub const STATIC_LEN: usize = 128;

    #[inline]
    pub fn new() -> Self {
        Self { buf: SmallVec::default() }
    }

    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        let buf = if capacity > Self::STATIC_LEN {
            SmallVec::Vec(Vec::with_capacity(capacity))
        } else {
            SmallVec::default()
        };

        Self { buf }
    }

    #[inline(always)]
    pub fn write(&mut self, bytes: &[u8]) {
        self.buf.write(bytes);
    }

    #[inline(always)]
    pub fn write_byte(&mut self, byte: u8) {
        self.buf.write(&[byte]);
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.buf.len()
    }

    #[inline]
    pub fn as_slice(&self) -> &[u8] {
        &self.buf.as_slice()
    }
}

impl<T: FadromaSerialize> FadromaSerializeExt for T {
    #[inline]
    fn serialize(&self) -> Result<Vec<u8>> {
        let mut ser = Serializer::with_capacity(self.size_hint());
        self.to_bytes(&mut ser)?;

        Ok(ser.into())
    }
}

impl Deserializer {
    #[inline]
    pub fn new(bytes: Vec<u8>) -> Self {
        Self::from(bytes)
    }

    #[inline]
    pub fn deserialize<T: FadromaDeserialize>(&mut self) -> Result<T> {
        T::from_bytes(self)
    }

    #[inline]
    pub fn read(&mut self, n: usize) -> Result<&[u8]> {
        let upper = self.read + n;

        if upper > self.bytes.len() {
            return Err(self.end_of_stream_err(n));
        }

        let bytes = &mut self.bytes[self.read..upper];
        self.read += n;

        Ok(bytes)
    }

    #[inline]
    pub fn read_byte(&mut self) -> Result<u8> {
        Ok(self.read(1)?[0])
    }

    #[inline]
    pub fn is_finished(&self) -> bool {
        self.read == self.bytes.len()
    }

    #[inline]
    fn end_of_stream_err(&self, requested: usize) -> Error {
        Error::EndOfStream {
            total: self.bytes.len(),
            read: self.read,
            requested
        }
    }
}

impl From<Vec<u8>> for Serializer {
    fn from(bytes: Vec<u8>) -> Self {
        Self {
            buf: SmallVec::Vec(bytes)
        }
    }
}

impl Into<Vec<u8>> for Serializer {
    fn into(self) -> Vec<u8> {
        match self.buf {
            SmallVec::Array { .. } => self.buf.as_slice().into(),
            SmallVec::Vec(buf) => buf
        }
    }
}

impl From<Vec<u8>> for Deserializer {
    fn from(bytes: Vec<u8>) -> Self {
        Self {
            read: 0,
            bytes
        }
    }
}

impl<const N: usize> SmallVec<N> {
    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        if bytes.is_empty() {
            return;
        }

        match self {
            Self::Array { index, buf } => {
                if N - *index < bytes.len() {
                    let slice = self.as_slice();

                    let mut new = Vec::with_capacity(slice.len() + bytes.len());
                    new.extend_from_slice(slice);
                    new.extend_from_slice(bytes);

                    *self = Self::Vec(new);
                } else {
                    unsafe {
                        ptr::copy_nonoverlapping(
                            bytes.as_ptr(),
                            buf.as_mut_ptr().add(*index),
                            bytes.len()
                        );
                    }

                    *index += bytes.len();
                }
            },
            Self::Vec(buf) => buf.extend_from_slice(bytes)
        }
    }

    #[inline]
    pub fn len(&self) -> usize {
        match self {
            Self::Array { index, .. } => *index,
            Self::Vec(buf) => buf.len()
        }
    }

    #[inline]
    fn as_slice(&self) -> &[u8] {
        match self {
            Self::Array { index, buf } => &buf[0..*index],
            Self::Vec(buf) => &buf
        }
    }
}

impl<const N: usize> Default for SmallVec<N> {
    #[inline]
    fn default() -> Self {
        Self::Array { index: 0, buf: [0; N] }
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use std::fmt::Debug;
    use super::*;

    pub fn serde<T>(item: &T)
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        
        let mut de = Deserializer::from(bytes);
        let result = de.deserialize::<T>().unwrap();

        assert_eq!(result, *item);
    }

    pub fn serde_len<T>(item: &T, byte_len: usize)
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        assert_eq!(bytes.len(), byte_len);

        let mut de = Deserializer::from(bytes);
        let result = de.deserialize::<T>().unwrap();

        assert_eq!(result, *item);
    }

    #[test]
    fn small_vec() {
        let mut vec = SmallVec::<8>::default();
        assert_eq!(vec.len(), 0);

        vec.write(&[]);
        assert_eq!(vec.len(), 0);

        vec.write(&[1; 3]);
        assert_eq!(vec.len(), 3);
        assert_eq!(vec.as_slice(), &[1; 3]);

        vec.write(&[1; 3]);
        assert_eq!(vec.len(), 6);
        assert_eq!(vec.as_slice(), &[1; 6]);

        vec.write(&[1; 2]);
        assert!(matches!(vec, SmallVec::Array { .. }));
        assert_eq!(vec.len(), 8);
        assert_eq!(vec.as_slice(), &[1; 8]);

        let slice = [1; 8].as_slice();

        vec.write(&[2]);
        assert!(matches!(vec, SmallVec::Vec { .. }));
        assert_eq!(vec.len(), 9);
        assert_eq!(vec.as_slice(), &[slice, &[2]].concat());

        vec.write(&[2; 3]);
        assert_eq!(vec.len(), 12);
        assert_eq!(vec.as_slice(), &[slice, &[2; 4]].concat());
    }
}

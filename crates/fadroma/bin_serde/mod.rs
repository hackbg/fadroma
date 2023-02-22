//! Time and space efficient binary serialization for types that are stored in a contract's storage.
//! Supports both structs and enums, with or without generics.
//! This is Fadroma's *default* mode for serializing data for storage.

pub mod adapter;

mod byte_len;
mod uint;
mod stdlib;
mod cw;

pub use fadroma_derive_serde::{FadromaSerialize, FadromaDeserialize};
pub use byte_len::ByteLen;

use std::fmt::Display;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(PartialEq, Debug)]
pub enum Error {
    /// Emitted when trying to read more bytes than
    /// there are available/remaining from a [`Deserializer`].
    EndOfStream {
        total: usize,
        read: usize,
        requested: usize
    },
    /// Emitted when trying to encode the `usize` length
    /// of a sequence type which exceeds [`ByteLen::MAX`].
    ByteLenTooLong {
        len: usize
    },
    /// Emitted (usually when deserializing) when some byte/s
    /// are interpreted as invalid in the context of the given type.
    /// This strongly depends on the particular type and some types may
    /// not even have bytes that are "invalid" (such as numeric types).
    InvalidType
}

/// A type that knows how to serialize itself to bytes.
/// Can be derived.
pub trait FadromaSerialize {
    /// The size in bytes of the particular instance when
    /// converted to its byte respresentation. While it's
    /// preferred that this method returns an exact size
    /// (or at least a bigger estimation) it's not an error
    /// to return an incorrect number. The penalty for doing
    /// so is potentially incurring unnecessary re-allocations.
    fn size_hint(&self) -> usize;
    /// Serialize the instance into bytes by writing to
    /// the provided [`Serializer`].
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()>;
}

/// A type that knows how to create an instance of itself
/// given a stream of raw bytes.
/// Can be derived.
pub trait FadromaDeserialize: Sized {
    /// Deserialize into a new instance by reading bytes from
    /// the provided [`Deserializer`].
    fn from_bytes<'a>(de: &mut Deserializer<'a>) -> Result<Self>;
}

/// Extension trait for conveniently serializing types that
/// implement [`FadromaSerialize`] into bytes.
pub trait FadromaSerializeExt: FadromaSerialize {
    fn serialize(&self) -> Result<Vec<u8>>;
}

pub struct Serializer {
    buf: Vec<u8>
}

pub struct Deserializer<'a> {
    read: usize,
    bytes: &'a [u8]
}

impl Serializer {
    #[inline]
    pub fn new() -> Self {
        Self { buf: Vec::new() }
    }

    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        Self { buf: Vec::with_capacity(capacity) }
    }

    #[inline]
    pub fn capacity(&self) -> usize {
        self.buf.capacity()
    }

    #[inline]
    pub fn reserve(&mut self, additional: usize) {
        self.buf.reserve(additional);
    }

    #[inline]
    pub fn reserve_exact(&mut self, additional: usize) {
        self.buf.reserve_exact(additional);
    }

    #[inline]
    pub fn write(&mut self, bytes: &[u8]) {
        self.buf.extend_from_slice(bytes);
    }

    #[inline]
    pub fn write_byte(&mut self, byte: u8) {
        self.buf.push(byte);
    }

    #[inline]
    pub fn finish(self) -> Vec<u8> {
        self.buf
    }
}

impl<T: FadromaSerialize> FadromaSerializeExt for T {
    #[inline]
    fn serialize(&self) -> Result<Vec<u8>> {
        let mut ser = Serializer::with_capacity(self.size_hint());
        self.to_bytes(&mut ser)?;

        Ok(ser.finish())
    }
}

impl<'a> Deserializer<'a> {
    #[inline]
    pub fn deserialize<T: FadromaDeserialize>(&mut self) -> Result<T> {
        T::from_bytes(self)
    }

    /// Read the specified number of bytes or return
    /// an [`Error::EndOfStream`] if attempting to read
    /// more bytes than currently available. If this
    /// method succeeds it is **guaranteed** to return
    /// the exact number of bytes requested.
    #[inline]
    pub fn read(&mut self, n: usize) -> Result<&[u8]> {
        let upper = self.read + n;

        if upper > self.bytes.len() {
            return Err(self.end_of_stream_err(n));
        }

        let bytes = &self.bytes[self.read..upper];
        self.read += n;

        Ok(bytes)
    }

    /// Convenience method for reading a single byte.
    /// Has the same semantics as [`Deserializer::read`].
    #[inline]
    pub fn read_byte(&mut self) -> Result<u8> {
        Ok(self.read(1)?[0])
    }

    /// Returns the *total* number of bytes available for reading.
    /// This means that it does **not** account for how many have
    /// been read thus far.
    #[inline]
    pub fn len(&self) -> usize {
        self.bytes.len()
    }

    /// Returns `true` if **all** available bytes have been read.
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

impl<'a, T: AsRef<[u8]>> From<&'a T> for Deserializer<'a> {
    fn from(bytes: &'a T) -> Self {
        Self {
            read: 0,
            bytes: bytes.as_ref()
        }
    }
}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::EndOfStream { total, read, requested } => f.write_fmt(
                    format_args!(
                        "Attempted to read {} bytes but {} remain.",
                        requested,
                        total - read
                    )
                ),
            Error::ByteLenTooLong { len } => f.write_fmt(
                format_args!("Sequence item length ({}) exceeded. Max: {}", len, ByteLen::MAX)
            ),
            Error::InvalidType => f.write_str("Invalid type.")
        }
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use std::fmt::Debug;
    use proptest::{prelude::TestCaseError, prop_assert_eq};
    use super::*;

    pub fn serde<T>(item: &T)
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        
        let mut de = Deserializer::from(&bytes);
        let result = de.deserialize::<T>().unwrap();

        assert!(de.is_finished());
        assert_eq!(result, *item);
    }

    pub fn serde_len<T>(item: &T, byte_len: usize)
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        assert_eq!(bytes.len(), byte_len);

        let mut de = Deserializer::from(&bytes);
        let result = de.deserialize::<T>().unwrap();

        assert!(de.is_finished());
        assert_eq!(result, *item);
    }

    pub fn proptest_serde<T>(item: &T) -> std::result::Result<(), TestCaseError>
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        
        let mut de = Deserializer::from(&bytes);
        let result = de.deserialize::<T>().unwrap();

        assert!(de.is_finished());
        assert_eq!(result, *item);

        Ok(())
    }

    pub fn proptest_serde_len<T>(item: &T, byte_len: usize) -> std::result::Result<(), TestCaseError>
        where T: FadromaSerialize + FadromaDeserialize + PartialEq + Debug
    {
        let bytes = item.serialize().unwrap();
        prop_assert_eq!(bytes.len(), byte_len);

        let mut de = Deserializer::from(&bytes);
        let result = de.deserialize::<T>().unwrap();

        prop_assert_eq!(de.is_finished(), true);
        prop_assert_eq!(&result, item);

        Ok(())
    }
}

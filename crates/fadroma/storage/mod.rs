//! Utilities for interacting with the native key-value storage.

pub mod iterable;
pub mod map;

mod single_item;
mod item_space;

pub use single_item::*;
pub use item_space::*;

use std::{any, convert::{TryFrom, TryInto}};

use crate::{
    bin_serde::{FadromaSerialize, FadromaDeserialize, FadromaSerializeExt, Deserializer},
    cosmwasm_std::{
        Storage, StdResult, StdError, CanonicalAddr,
        Addr, Uint64, Uint128, Uint256, Uint512
    }
};

/// Construct a storage namespace. It creates a
/// zero-sized struct with the given type name and
/// implements [`Namespace`] on it with the provied
/// byte slice literal.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::storage::Namespace;
/// 
/// fadroma::namespace!(MyNamespace, b"ns_bytes");
/// assert_eq!(MyNamespace::NAMESPACE, b"ns_bytes");
/// ```
#[macro_export]
macro_rules! namespace {
    ($visibility:vis $name:ident, $bytes: literal) => {
        $visibility struct $name;

        impl $crate::storage::Namespace for $name {
            const NAMESPACE: &'static [u8] = $bytes;
        }
    };
}

pub type Segments<'a> = &'a [&'a [u8]];

/// Represents a namespace, usually acting as a prefix
/// to a dynamically generated key. We only do this so
/// that we can have strongly typed keys and storage types.
/// Use the [`namespace`] macro to generate one.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::storage::Namespace;
/// 
/// fadroma::namespace!(MyNamespace, b"ns_bytes");
/// assert_eq!(MyNamespace::NAMESPACE, b"ns_bytes");
/// ```
pub trait Namespace {
    const NAMESPACE: &'static [u8];
}

/// Implemented for types that act as CW storage keys by writing
/// bytes into the given buffer. What those bytes represent and
/// where they are coming from as well as how they are written
/// into the buffer entirely depends on the implementing type.
/// 
/// The [`Key::size`] method is used to report the amount of
/// bytes that the key will write. This allows us to efficiently
/// allocate the exact amount of memory that we will need to construct
/// the final key. It exists because the provided buffer might be larger
/// than the size of the given key since multiple keys can be concatenated
/// or a prefix (such as a [`Namespace`]) might be added to the final key.
/// This depends entirely on the given scenario and is taken care of by the
/// storage types. There are already several key types provided which should
/// cover pretty much all use cases.
pub trait Key {
    fn size(&self) -> usize;
    fn write_segments(&self, buf: &mut Vec<u8>);
}

/// Represents types that can be used to construct a [`TypedKey`] and
/// its variants. Although it has the exact same method definitions as
/// the [`Key`] trait, it differs in its specific usage scenario and as
/// such the two traits are not connected in any way at the type level.
pub trait Segment {
    fn size(&self) -> usize;
    fn write_segment(&self, buf: &mut Vec<u8>);
}

/// A key with an arbitrary number of segments.
/// Writes them in order of the iteration.
#[derive(Clone, Copy, PartialEq, Hash, Debug)]
pub struct CompositeKey<'a>(Segments<'a>);

/// A key which consists of a static byte slice.
#[derive(Clone, Copy, PartialEq, Hash, Debug)]
pub struct StaticKey(pub &'static [u8]);

/// A key with a pre-defined number of segments.
/// Writes them in order of the iteration.
#[derive(Clone, Copy, PartialEq, Hash, Debug)]
pub struct FixedSegmentSizeKey<'a, const N: usize>([&'a [u8]; N]);

/// A strongly-typed key with segments defined by the concrete type
/// which must implement [`Segment`]. For typed keys which consist of
/// multiple types use [`TypedKey2`], [`TypedKey3`] and [`TypedKey4`].
/// Constructs the key in order of definition.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::{
///     cosmwasm_std::testing::mock_dependencies,
///     storage::{Key, ItemSpace, TypedKey2}
/// };
/// 
/// fadroma::namespace!(NumbersNs, b"numbers");
/// 
/// // Storage for u64 numbers with a key that consists of b"numbers" + a string + a byte.
/// const NUMBERS: ItemSpace::<u64, NumbersNs, TypedKey2<String, u8>> = ItemSpace::new();
/// 
/// let mut deps = mock_dependencies();
/// let storage = deps.as_mut().storage;
/// 
/// let string_segment = "hello".to_string();
/// let number_segment = 33u8;
/// 
/// NUMBERS.save(storage, (&string_segment, &number_segment), &1).unwrap();
/// 
/// // Can also be constructed like this
/// let key = TypedKey2::from((&string_segment, &number_segment));
/// NUMBERS.save(storage, key.clone(), &1).unwrap();
/// 
/// let mut bytes: Vec<u8> = Vec::with_capacity(key.size());
/// key.write_segments(&mut bytes);
/// 
/// assert_eq!(
///     bytes,
///     [string_segment.as_bytes(), &number_segment.to_be_bytes()].concat()
/// );
/// ```
#[derive(Clone, Copy, PartialEq, Hash, Debug)]
pub struct TypedKey<'a, T: Segment + ?Sized>(&'a T);

/// Save something to the storage.
#[inline]
pub fn save<T: FadromaSerialize> (
    storage: &mut dyn Storage,
    key: impl AsRef<[u8]>,
    value: &T
) -> StdResult<()> {
    let bytes = serialize(value)?;
    storage.set(key.as_ref(), &bytes);

    Ok(())
}

/// Remove something from the storage.
#[inline]
pub fn remove(
    storage: &mut dyn Storage,
    key: impl AsRef<[u8]>
) {
    storage.remove(key.as_ref());
}

/// Load something from the storage.
#[inline]
pub fn load<T: FadromaDeserialize> (
    storage: &dyn Storage,
    key: impl AsRef<[u8]>
) -> StdResult<Option<T>> {
    match storage.get(key.as_ref()) {
        Some(data) => {
            let item = deserialize::<T>(&data)?;

            Ok(Some(item))
        },
        None => Ok(None)
    }
}

#[inline(always)]
pub(crate) fn serialize<T: FadromaSerialize>(value: &T) -> StdResult<Vec<u8>> {
    value.serialize().map_err(|e|
        StdError::serialize_err(any::type_name::<T>(), e)
    )
}

#[inline(always)]
pub(crate) fn deserialize<T: FadromaDeserialize>(bytes: &[u8]) -> StdResult<T> {
    let mut de = Deserializer::from(&bytes);

    de.deserialize::<T>().map_err(|e|
        StdError::parse_err(any::type_name::<T>(), e)
    )
}

impl<'a> Key for CompositeKey<'a> {
    #[inline]
    fn size(&self) -> usize {
        self.0.iter().map(|x| x.len()).sum()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        for segment in self.0 {
            buf.extend_from_slice(segment);
        }
    }
}

impl<'a> CompositeKey<'a> {
    #[inline]
    pub fn new(segments: Segments<'a>) -> Self {
        Self(segments)
    }
}

impl<'a> From<Segments<'a>> for CompositeKey<'a> {
    #[inline]
    fn from(segments: Segments<'a>) -> Self {
        Self(segments)
    }
}

impl Key for StaticKey {
    #[inline]
    fn size(&self) -> usize {
        self.0.len()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.0);
    }
}

impl<'a, const N: usize> Key for FixedSegmentSizeKey<'a, N> {
    #[inline]
    fn size(&self) -> usize {
        self.0.iter().map(|x| x.len()).sum()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        for segment in self.0 {
            buf.extend_from_slice(segment);
        }
    }
}

impl<'a, const N: usize> FixedSegmentSizeKey<'a, N> {
    #[inline]
    pub fn new(segments: [&'a [u8]; N]) -> Self {
        Self(segments)
    }
}

impl<'a, const N: usize> From<[&'a [u8]; N]> for FixedSegmentSizeKey<'a, N> {
    #[inline]
    fn from(segments: [&'a [u8]; N]) -> Self {
        Self(segments)
    }
}

impl<'a, const N: usize> TryFrom<Segments<'a>> for FixedSegmentSizeKey<'a, N> {
    type Error = StdError;

    #[inline]
    fn try_from(segments: Segments<'a>) -> Result<Self, Self::Error> {
        let segments: [&'a [u8]; N] = segments.try_into()
            .map_err(|_|
                StdError::invalid_data_size(N, segments.len())
            )?;

        Ok(Self(segments))
    }
}

impl<'a, T: Segment + ?Sized> Key for TypedKey<'a, T> {
    #[inline]
    fn size(&self) -> usize {
        self.0.size()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        self.0.write_segment(buf);
    }
}

impl<'a, T: Segment + ?Sized> From<&'a T> for TypedKey<'a, T> {
    #[inline]
    fn from(value: &'a T) -> Self {
        Self(value)
    }
}

macro_rules! impl_typed_key {
    ($name:ident $(<$lt:lifetime, $($param:ident),+>)+ [$($num:tt),+]) => {
        #[derive(Clone, Copy, PartialEq, Hash, Debug)]
        pub struct $name $(<$lt, $($param: Segment + ?Sized),+>)+ (($($(&$lt $param),+)+));

        impl $(<$lt, $($param: Segment + ?Sized),+>)+ Key for $name $(<$lt, $($param),+>)+ {
            #[inline]
            fn size(&self) -> usize {
                self.0.0.size() $(+ self.0.$num.size())+
            }
        
            #[inline]
            fn write_segments(&self, buf: &mut Vec<u8>) {
                self.0.0.write_segment(buf);
                $(self.0.$num.write_segment(buf);)+
            }
        }

        impl $(<$lt, $($param: Segment + ?Sized),+>)+ From<($($(&$lt $param),+)+)> for $name $(<$lt, $($param),+>)+ {
            #[inline]
            fn from(value: ($($(&$lt $param),+)+)) -> Self {
                Self(value)
            }
        }
    };
}

impl_typed_key!(TypedKey2<'a, T1, T2> [1]);
impl_typed_key!(TypedKey3<'a, T1, T2, T3> [1, 2]);
impl_typed_key!(TypedKey4<'a, T1, T2, T3, T4> [1, 2, 3]);

impl<T: Namespace> Key for T {
    #[inline]
    fn size(&self) -> usize {
        Self::NAMESPACE.len()
    }

    #[inline]
    fn write_segments(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(Self::NAMESPACE);
    }
}

impl<T: Key> Segment for T {
    #[inline]
    fn size(&self) -> usize {
        <Self as Key>::size(self)
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        self.write_segments(buf);
    }
}

impl Segment for &str {
    #[inline]
    fn size(&self) -> usize {
        self.as_bytes().len()
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.as_bytes());
    }
}

impl Segment for String {
    #[inline]
    fn size(&self) -> usize {
        self.as_bytes().len()
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.as_bytes());
    }
}

impl Segment for Addr {
    #[inline]
    fn size(&self) -> usize {
        self.as_bytes().len()
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(self.as_bytes());
    }
}

impl Segment for CanonicalAddr {
    #[inline]
    fn size(&self) -> usize {
        self.len()
    }

    #[inline]
    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(&self);
    }
}

macro_rules! impl_num_segment {
    ($data:ty) => {
        impl Segment for $data {
            #[inline]
            fn size(&self) -> usize {
                std::mem::size_of::<Self>()
            }
        
            #[inline]
            fn write_segment(&self, buf: &mut Vec<u8>) {
                buf.extend_from_slice(&self.to_be_bytes());
            }
        }
    };
}

impl_num_segment!(u8);
impl_num_segment!(u16);
impl_num_segment!(u32);
impl_num_segment!(u64);
impl_num_segment!(u128);
impl_num_segment!(Uint64);
impl_num_segment!(Uint128);
impl_num_segment!(Uint256);
impl_num_segment!(Uint512);

#[inline]
fn not_found_error<T>() -> StdError {
    StdError::not_found(format!("Storage load: {}", any::type_name::<T>()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_keys() {
        const WORD: &str = "test";

        fn test(key: impl Key, len: usize) {
            assert_eq!(key.size(), WORD.len() * len);

            let mut buf = Vec::with_capacity(key.size());
            key.write_segments(&mut buf);

            assert_eq!(buf, WORD.as_bytes().repeat(len));
        }

        test(TypedKey2::from((&WORD, &WORD)), 2);
        test(TypedKey3::from((&WORD, &WORD, &WORD)), 3);
        test(TypedKey4::from((&WORD, &WORD, &WORD, &WORD)), 4);
    }
}

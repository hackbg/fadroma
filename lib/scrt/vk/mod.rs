//! Viewing key authentication.
//! *Feature flag: `vk`*

//Based on https://github.com/enigmampc/snip20-reference-impl/blob/master/src/viewing_key.rs

use std::{fmt, convert::{TryFrom, TryInto}};
use serde::{Deserialize, Serialize};
use subtle::ConstantTimeEq;

use crate::{
    self as fadroma,
    prelude::*,
    crypto::{Prng, sha_256},
    impl_canonize_default
};

pub mod auth;

const VIEWING_KEY_PREFIX: &str = "api_key_";

/// Represents a viewing key string which is provided as _unverified_ input to a query.
/// 
/// [`PartialEq`] is intentionally not implemented on this type in order to prevent
/// from using it to check viewing keys that way. You should convert to [`ViewingKeyHashed`]
/// (using [`ViewingKey::to_hashed`]) and then call [`ViewingKeyHashed::check`] which performs
/// a specialized constant time equality comparison. [`ViewingKey::check`] and
/// [`ViewingKey::check_hashed`] are also provided for convenience.
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, JsonSchema, Clone, Default, Debug)]
pub struct ViewingKey(pub String);

/// [`ViewingKey`] as a SHA-256 hash.
/// 
/// [`PartialEq`] is intentionally not implemented on this type in order to prevent
/// from using it to check viewing keys that way. Use [`ViewingKeyHashed::check`]
/// instead which performs a specialized constant time equality comparison.
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, JsonSchema, Clone, Copy, Default, Debug)]
pub struct ViewingKeyHashed([u8; Self::SIZE]);

impl_canonize_default!(ViewingKey);
impl_canonize_default!(ViewingKeyHashed);

impl ViewingKey {
   pub fn new(env: &Env, info: &MessageInfo, seed: &[u8], entropy: &[u8]) -> Self {
        // 16 here represents the lengths in bytes of the block height and time.
        let entropy_len = 16 + info.sender.as_str().len() + entropy.len();

        let mut rng_entropy = Vec::with_capacity(entropy_len);
        rng_entropy.extend_from_slice(&env.block.height.to_be_bytes());
        rng_entropy.extend_from_slice(&env.block.time.seconds().to_be_bytes());
        rng_entropy.extend_from_slice(&info.sender.as_bytes());
        rng_entropy.extend_from_slice(entropy);

        let mut rng = Prng::new(seed, &rng_entropy);
        let rand_slice = rng.rand_bytes();

        let key = sha_256(&rand_slice);

        Self(VIEWING_KEY_PREFIX.to_string() + &Binary::from(&key).to_base64())
    }

    /// Converts the viewing key to SHA-256 hash representation.
    #[inline]
    pub fn to_hashed(&self) -> ViewingKeyHashed {
        ViewingKeyHashed(sha_256(self.as_bytes()))
    }

    #[inline]
    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }

    /// Converts both `self` and `other` to [`ViewingKeyHashed`]
    /// and compares them for equality using a constant time function.
    #[inline]
    pub fn check(&self, other: &ViewingKey) -> bool {
        let this = self.to_hashed();
        let other = other.to_hashed();

        this.check(&other)
    }

    /// Converts `self` to [`ViewingKeyHashed`] and compares
    /// it to `other` for equality using a constant time function.
    #[inline]
    pub fn check_hashed(&self, hashed: &ViewingKeyHashed) -> bool {
        let this = self.to_hashed();

        this.check(&hashed)
    }
}

impl ViewingKeyHashed {
    /// The size in bytes of the hash.
    pub const SIZE: usize = 32;

    /// Compares both instances for equality using a constant time function.
    #[inline]
    pub fn check(&self, other: &Self) -> bool {
        bool::from(self.as_slice().ct_eq(other.as_slice()))
    }

    #[inline]
    pub fn as_slice(&self) -> &[u8] {
        self.0.as_slice()
    }
}

impl AsRef<str> for ViewingKey {
    #[inline]
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<[u8]> for ViewingKey {
    #[inline]
    fn as_ref(&self) -> &[u8] {
        self.as_bytes()
    }
}

impl fmt::Display for ViewingKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl<T: Into<String>> From<T> for ViewingKey {
    #[inline]
    fn from (vk: T) -> Self {
        ViewingKey(vk.into())
    }
}

impl From<&[u8; Self::SIZE]> for ViewingKeyHashed {
    #[inline]
    fn from(array: &[u8; Self::SIZE]) -> Self {
        Self(*array)
    }
}

impl From<[u8; Self::SIZE]> for ViewingKeyHashed {
    #[inline]
    fn from(array: [u8; Self::SIZE]) -> Self {
        Self(array)
    }
}

impl TryFrom<&[u8]> for ViewingKeyHashed {
    type Error = StdError;

    fn try_from(slice: &[u8]) -> Result<Self, Self::Error> {
        let array = slice.try_into().map_err(|_|
            StdError::InvalidDataSize {
                expected: Self::SIZE as u64,
                actual: slice.len() as u64
            }
        )?;

        Ok(Self(array))
    }
}

impl AsRef<[u8]> for ViewingKeyHashed {
    #[inline]
    fn as_ref(&self) -> &[u8] {
        self.as_slice()
    }
}

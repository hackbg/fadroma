use std::str::FromStr;
use std::convert::{TryFrom, TryInto};
use std::fmt;
use std::ops::{Add, Sub, Mul, Div};

use cosmwasm_std::{StdResult, StdError, Uint128};
use serde::{de, ser, Deserialize, Deserializer, Serialize};
use schemars::JsonSchema;
use primitive_types::U256;

macro_rules! error {
    (OVERFLOW: $lhs:expr, $op:expr, $rhs:expr) => {
        error!(format!("Overflow when calculating {} {} {}", $lhs, $op, $rhs))
    };
    (UNDERFLOW: $lhs:expr, $op:expr, $rhs:expr) => {
        error!(format!("Underflow when calculating {} {} {}", $lhs, $op, $rhs))
    };
    ($msg:expr) => {
        StdError::generic_err($msg)
    };
}

#[derive(Copy, Clone, Default, Debug, PartialEq, Eq, PartialOrd, Ord, JsonSchema)]
pub struct Uint256(#[schemars(with = "String")] pub U256);

impl Uint256 {
    /// U256 sqrt ported from here: https://ethereum.stackexchange.com/a/87713/12112
    ///
    /// function sqrt(uint y) internal pure returns (uint z) {
    ///     if (y > 3) {
    ///         z = y;
    ///         uint x = y / 2 + 1;
    ///         while (x < z) {
    ///             z = x;
    ///             x = (y / x + x) / 2;
    ///         }
    ///     } else if (y != 0) {
    ///         z = 1;
    ///     }
    /// }
    ///
    /// Tested it here: https://github.com/enigmampc/u256-sqrt-test/blob/aa7693/src/main.rs
    pub fn sqrt(self) -> StdResult<Self> {
        let mut z = Self::from(0);

        if self.gt(&Self::from(3)) {
            z = self.clone();
            let mut x = self.checked_div(Self::from(2))?.checked_add(Self::from(1))?;

            while x.lt(&z) {
                z = x.clone();
                x = self
                    .checked_div(x)?
                    .checked_add(x)?
                    .checked_div(Self::from(2))?;
            }
        } else if !self.is_zero() {
            z = Self::from(1);
        }

        return Ok(z);
    }

    /// returns self * nom / denom
    pub fn multiply_ratio<A: Into<Self>, B: Into<Self>>(self, nom: A, denom: B) -> StdResult<Uint256> {
        let nominator = nom.into();
        let denominator = denom.into();

        if denominator == Self::zero() {
            return Err(StdError::generic_err("Denominator cannot be zero"));
        }

        (self * Uint256::from(nominator))? / Uint256::from(denominator)
    }

    pub fn is_zero(&self) -> bool {
        self.0.is_zero()
    }

    pub fn zero() -> Self {
        Uint256(U256::zero())
    }

    pub fn checked_div(self, rhs: Self) -> StdResult<Self> {
        self / rhs
    }

    pub fn checked_mul(self, rhs: Self) -> StdResult<Self> {
        self * rhs
    }

    pub fn checked_sub(self, rhs: Self) -> StdResult<Self> {
        self - rhs
    }

    pub fn checked_add(self, rhs: Self) -> StdResult<Self> {
        self + rhs
    }

    pub fn checked_pow(self, rhs: Self) -> StdResult<Self> {
        match self.0.checked_pow(rhs.0) {
            Some(res) => Ok(res.into()),
            None => Err(error!(OVERFLOW: self, "**", rhs))
        }
    }

    /// Return the first 128 bits.
    pub fn low_u128(self) -> u128 {
        self.0.low_u128()
    }

    /// Return the first 128 bits or an error if the current number would overflow a u128.
    pub fn clamp_u128(self) -> StdResult<u128> {
        if self.0.0[3] > 0 {
            return Err(StdError::generic_err("u128 overflow"));
        }

        Ok(self.0.low_u128())
    }
}

impl Add for Uint256 {
    type Output = StdResult<Self>;

    fn add(self, rhs: Self) -> Self::Output {
        match self.0.checked_add(rhs.0) {
            Some(res) => Ok(res.into()),
            None => Err(error!(OVERFLOW: self, '+', rhs))
        }
    }
}

impl Sub for Uint256 {
    type Output = StdResult<Self>;

    fn sub(self, rhs: Self) -> Self::Output {
        match self.0.checked_sub(rhs.0) {
            Some(res) => Ok(res.into()),
            None => Err(error!(UNDERFLOW: self, '-', rhs))
        }
    }
}

impl Mul for Uint256 {
    type Output = StdResult<Self>;

    fn mul(self, rhs: Self) -> Self::Output {
        match self.0.checked_mul(rhs.0) {
            Some(res) => Ok(res.into()),
            None => Err(error!(OVERFLOW: self, '*', rhs))
        }
    }
}

impl Div for Uint256 {
    type Output = StdResult<Self>;

    fn div(self, rhs: Self) -> Self::Output {
        match self.0.checked_div(rhs.0) {
            Some(res) => Ok(res.into()),
            None => Err(StdError::generic_err("Division by zero"))
        }
    }
}

impl From<Uint128> for Uint256 {
    fn from(value: Uint128) -> Self {
        Uint256::from(value.u128())
    }
}

impl From<U256> for Uint256 {
    fn from(value: U256) -> Self {
        Uint256(value)
    }
}

impl From<i128> for Uint256 {
    fn from(value: i128) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<u128> for Uint256 {
    fn from(value: u128) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<i64> for Uint256 {
    fn from(value: i64) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<u64> for Uint256 {
    fn from(value: u64) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<i32> for Uint256 {
    fn from(value: i32) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<u32> for Uint256 {
    fn from(value: u32) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<i16> for Uint256 {
    fn from(value: i16) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<u16> for Uint256 {
    fn from(value: u16) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<i8> for Uint256 {
    fn from(value: i8) -> Self {
        Uint256(U256::from(value))
    }
}

impl From<u8> for Uint256 {
    fn from(value: u8) -> Self {
        Uint256(U256::from(value))
    }
}

impl FromStr for Uint256 {
    type Err = StdError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let result = U256::from_dec_str(s)
            .map_err(|x| StdError::generic_err(x.to_string()))?;

        Ok(Uint256(result))
    }
}

impl TryFrom<&str> for Uint256 {
    type Error = StdError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        Uint256::from_str(s)
    }
}

impl TryInto<Uint128> for Uint256 {
    type Error = StdError;

    fn try_into(self) -> Result<Uint128, Self::Error> {
        self.clamp_u128().map(|x| Uint128(x))
    }
}

impl fmt::Display for Uint256 {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Serialize for Uint256 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Uint256 {
    fn deserialize<D>(deserializer: D) -> Result<Uint256, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_str(Uint256Visitor)
    }
}

struct Uint256Visitor;

impl<'de> de::Visitor<'de> for Uint256Visitor {
    type Value = Uint256;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("String-encoded integer")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Uint256::from_str(v).map_err(|x|
            E::custom(format!("Invalid Uint256 '{}' - {}", v, x.to_string()))
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{to_vec, from_slice};

    #[test]
    fn sqrt() {
        assert_eq!(Uint256::from(100).sqrt().unwrap(), Uint256::from(10));
        assert_eq!(Uint256::from(64).sqrt().unwrap(), Uint256::from(8));
        assert_eq!(Uint256::from(36).sqrt().unwrap(), Uint256::from(6));
        assert_eq!(Uint256::from(9).sqrt().unwrap(), Uint256::from(3));
    }

    #[test]
    fn to_and_from() {
        let a: Uint256 = 12345u64.into();
        assert_eq!(12345, a.low_u128());
        assert_eq!("12345", a.to_string());

        let a: Uint256 = "34567".try_into().unwrap();
        assert_eq!(34567, a.clamp_u128().unwrap());
        assert_eq!("34567", a.to_string());

        let a: StdResult<Uint256> = "1.23".try_into();
        assert!(a.is_err());

	    assert_eq!(Uint256::from_str("000000000000000000000000000000000000000000000000000000000000000000").unwrap(), Uint256::zero());
        // Overflow
	    assert!(Uint256::from_str("100000000000000000000000000000000000000000000000000000000000000000000000000000000000000").is_err());

	    assert!(Uint256::from_str("8090a0b0c0d0e0f00910203040506077000000000000000100000000000012f0").is_err());
        assert!(Uint256::from_str("0x0910203040506077").is_err());
        assert!(Uint256::from_str("0x0a").is_err());
        assert!(Uint256::from_str("123.456").is_err());
    }

    #[test]
    fn serde() {
        let orig = Uint256::from(1234567890987654321u128);
        let serialized = to_vec(&orig).unwrap();
        assert_eq!(serialized.as_slice(), b"\"1234567890987654321\"");

        let parsed: Uint256 = from_slice(&serialized).unwrap();
        assert_eq!(parsed, orig);

        let result: StdResult<Uint256> = from_slice(b"123.456");
        assert!(result.is_err());

        let result: StdResult<Uint256> = from_slice(b"0x0910203040506077");
        assert!(result.is_err());
    }

    #[test]
    fn compare() {
        let a = Uint256::from(12345);
        let b = Uint256::from(23456);

        assert!(a < b);
        assert!(b > a);
        assert_eq!(a, Uint256::from(12345));
    }

    #[test]
    fn math() {
        let a = Uint256::from(12345);
        let b = Uint256::from(23456);

        // test + and - for valid values
        assert_eq!((a + b).unwrap(), Uint256::from(35801));
        assert_eq!((b - a).unwrap(), Uint256::from(11111));

        let mut c = Uint256::from(300000);
        c = (c + b).unwrap();
        assert_eq!(c, Uint256::from(323456));

        // error result on underflow (- would produce negative result)
        let underflow = a - b;
        assert_eq!(underflow.unwrap_err().to_string(), error!(UNDERFLOW: a, '-', b).to_string());

        let a = Uint256::from(1000);
        let b = Uint256::from(2);

        assert_eq!((a / b).unwrap(), Uint256::from(500));
        assert_eq!((a * b).unwrap(), Uint256::from(2000));
        assert_eq!((a.checked_pow(b)).unwrap(), Uint256::from(1000000));
    }

    #[test]
    fn multiply_ratio() {
        let base = Uint256::from(500);

        // factor 1/1
        assert_eq!(base.multiply_ratio(1u128, 1u128).unwrap(), Uint256::from(500));
        assert_eq!(base.multiply_ratio(3u128, 3u128).unwrap(), Uint256::from(500));
        assert_eq!(base.multiply_ratio(654321u128, 654321u128).unwrap(), Uint256::from(500));

        // factor 3/2
        assert_eq!(base.multiply_ratio(3u128, 2u128).unwrap(), Uint256::from(750));
        assert_eq!(base.multiply_ratio(333333u128, 222222u128).unwrap(), Uint256::from(750));

        // factor 2/3 (integer devision always floors the result)
        assert_eq!(base.multiply_ratio(2u128, 3u128).unwrap(), Uint256::from(333));
        assert_eq!(base.multiply_ratio(222222u128, 333333u128).unwrap(), Uint256::from(333));

        // factor 5/6 (integer devision always floors the result)
        assert_eq!(base.multiply_ratio(5u128, 6u128).unwrap(), Uint256::from(416));
        assert_eq!(base.multiply_ratio(100u128, 120u128).unwrap(), Uint256::from(416));
    }
}

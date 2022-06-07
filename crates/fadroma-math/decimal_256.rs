use std::{
    fmt::{self, Write},
    ops::{Add, Sub, Mul, Div},
    str::FromStr,
    convert::TryFrom
};

use fadroma_platform_scrt::{StdResult, Decimal, StdError, schemars};
use serde::{de, ser, Deserialize, Deserializer, Serialize};
use primitive_types::U256;

use crate::uint256::Uint256;
use crate::common::{error, impl_common_api};

/// A fixed-point decimal value with 18 fractional digits, i.e. Decimal256(1_000_000_000_000_000_000) == 1.0
/// The greatest possible value that can be represented is 115792089237316195423570985008687907853269984665640564039457.584007913129639935 (which is (2^128 - 1) / 10^18)
#[derive(Copy, Clone, Default, Debug, PartialEq, Eq, PartialOrd, Ord, schemars::JsonSchema)]
pub struct Decimal256(#[schemars(with = "String")] pub U256);

impl Decimal256 {
    pub const DECIMAL_FRACTIONAL: U256 = U256([1_000_000_000_000_000_000u64, 0, 0, 0]);

    #[inline]
    /// Create a 1.0 Decimal256
    pub const fn one() -> Self {
        Decimal256(Decimal256::DECIMAL_FRACTIONAL)
    }

    #[inline]
    /// Convert x% into Decimal256
    pub fn percent(x: u64) -> Self {
        Decimal256(U256::from(x) * U256::from(10_000_000_000_000_000u64))
    }

    #[inline]
    /// Convert permille (x/1000) into Decimal256
    pub fn permille(x: u64) -> Self {
        Decimal256(U256::from(x) * U256::from(1_000_000_000_000_000u64))
    }

    /// Returns the ratio (nominator / denominator) as a Decimal256
    pub fn from_ratio<A: Into<U256>, B: Into<U256>>(nominator: A, denominator: B) -> StdResult<Self> {
        let nominator: U256 = nominator.into();
        let denominator: U256 = denominator.into();

        if denominator.is_zero() {
            return Err(error!(DIV: nominator));
        }

        let nominator = nominator.checked_mul(Self::DECIMAL_FRACTIONAL).ok_or_else(||
            error!(OVERFLOW: nominator, '*', denominator)
        )?;

        Ok(Self(nominator / denominator))
    }

    #[inline]
    pub fn from_uint256(value: impl Into<Uint256>) -> StdResult<Self> {
        let value = value.into();

        Self::try_from(value)
    }

    #[inline]
    pub fn round(self) -> Uint256 {
        Uint256(self.0 / Self::DECIMAL_FRACTIONAL)
    }

    impl_common_api!();
}

impl TryFrom<Uint256> for Decimal256 {
    type Error = StdError;

    fn try_from(value: Uint256) -> Result<Self, Self::Error> {
        let num: Uint256 = value.into();

        match num.0.checked_mul(Decimal256::DECIMAL_FRACTIONAL) {
            Some(result) => Ok(Self(result)),
            None => Err(error!(OVERFLOW: value, '*', Decimal256::DECIMAL_FRACTIONAL))
        }
    }
}

impl TryFrom<Decimal> for Decimal256 {
    type Error = StdError;

    fn try_from(value: Decimal) -> Result<Self, Self::Error> {
        Decimal256::from_str(&value.to_string())
    }
}

impl FromStr for Decimal256 {
    type Err = StdError;

    /// Converts the decimal string to a Decimal256
    /// Possible inputs: "1.23", "1", "000012", "1.123000000"
    /// Disallowed: "", ".23"
    ///
    /// This never performs any kind of rounding.
    /// More than 18 fractional digits, even zeros, result in an error.
    fn from_str(input: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = input.split('.').collect();
        match parts.len() {
            1 => {
                let whole = U256::from_dec_str(parts[0])
                    .map_err(|_| StdError::generic_err("Error parsing whole"))?;

                let whole_as_atomics = whole * Decimal256::DECIMAL_FRACTIONAL;
                Ok(Decimal256(whole_as_atomics))
            }
            2 => {
                let whole = U256::from_dec_str(parts[0])
                    .map_err(|_| StdError::generic_err("Error parsing whole"))?;
                let fractional = U256::from_dec_str(parts[1])
                    .map_err(|_| StdError::generic_err("Error parsing fractional"))?;
                let exp = (18usize.checked_sub(parts[1].len())).ok_or_else(|| {
                    StdError::generic_err("Cannot parse more than 18 fractional digits")
                })?;
                let fractional_factor = U256::from(10).pow(exp.into());

                let whole_as_atomics = whole * Decimal256::DECIMAL_FRACTIONAL;
                let atomics = whole_as_atomics + fractional * fractional_factor;
                Ok(Decimal256(atomics))
            }
            _ => Err(StdError::generic_err("Unexpected number of dots")),
        }
    }
}

impl fmt::Display for Decimal256 {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let whole = (self.0) / Decimal256::DECIMAL_FRACTIONAL;
        let fractional = (self.0) % Decimal256::DECIMAL_FRACTIONAL;

        if fractional.is_zero() {
            write!(f, "{}", whole)
        } else {
            let fractional_string = fractional.to_string();
            let fractional_string = "0".repeat(18 - fractional_string.len()) + &fractional_string;

            f.write_str(&whole.to_string())?;
            f.write_char('.')?;
            f.write_str(fractional_string.trim_end_matches('0'))?;

            Ok(())
        }
    }
}

impl Add for Decimal256 {
    type Output = StdResult<Self>;

    fn add(self, rhs: Self) -> StdResult<Self> {
        match self.0.checked_add(rhs.0) {
            Some(res) => Ok(Self(res)),
            None => Err(error!(OVERFLOW: self, '+', rhs))
        }
    }
}

impl Sub for Decimal256 {
    type Output = StdResult<Self>;

    fn sub(self, rhs: Self) -> StdResult<Self> {
        match self.0.checked_sub(rhs.0) {
            Some(res) => Ok(Self(res)),
            None => Err(error!(UNDERFLOW: self, '-', rhs))
        }
    }
}

impl Mul for Decimal256 {
    type Output = StdResult<Self>;

    fn mul(self, rhs: Self) -> StdResult<Self> {
        match self.0.checked_mul(rhs.0).and_then(|x|
            x.checked_div(Self::DECIMAL_FRACTIONAL)
        ) {
            Some(res) => Ok(Self(res)),
            None => Err(error!(OVERFLOW: self, '*', rhs))
        }
    }
}

impl Div for Decimal256 {
    type Output = StdResult<Self>;

    fn div(self, rhs: Self) -> StdResult<Self> {
        Self::from_ratio(self.0, rhs.0)
    }
}

/// Serializes as a decimal string
impl Serialize for Decimal256 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Deserializes as a base64 string
impl<'de> Deserialize<'de> for Decimal256 {
    fn deserialize<D>(deserializer: D) -> Result<Decimal256, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_str(Decimal256Visitor)
    }
}

struct Decimal256Visitor;

impl<'de> de::Visitor<'de> for Decimal256Visitor {
    type Value = Decimal256;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("string-encoded decimal")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        match Decimal256::from_str(v) {
            Ok(d) => Ok(d),
            Err(e) => Err(E::custom(format!("Error parsing decimal '{}': {}", v, e))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use fadroma_platform_scrt::cosmwasm_std::{to_vec, from_slice};

    #[test]
    fn one() {
        let value = Decimal256::one();
        assert_eq!(value.0, Decimal256::DECIMAL_FRACTIONAL);
    }

    #[test]
    fn zero() {
        let value = Decimal256::zero();
        assert_eq!(value.0, U256::zero());
    }

    #[test]
    fn percent() {
        let value = Decimal256::percent(50);
        assert_eq!(value.0, Decimal256::DECIMAL_FRACTIONAL / U256::from(2) );
    }

    #[test]
    fn permille() {
        let value = Decimal256::permille(125);
        assert_eq!(value.0, Decimal256::DECIMAL_FRACTIONAL / U256::from(8));
    }

    #[test]
    fn from_ratio_works() {
        // 1.0
        assert_eq!(Decimal256::from_ratio(1, 1).unwrap(), Decimal256::one());
        assert_eq!(Decimal256::from_ratio(53, 53).unwrap(), Decimal256::one());
        assert_eq!(Decimal256::from_ratio(125, 125).unwrap(), Decimal256::one());

        // 1.5
        assert_eq!(Decimal256::from_ratio(3, 2).unwrap(), Decimal256::percent(150));
        assert_eq!(Decimal256::from_ratio(150, 100).unwrap(), Decimal256::percent(150));
        assert_eq!(Decimal256::from_ratio(333, 222).unwrap(), Decimal256::percent(150));

        // 0.125
        assert_eq!(Decimal256::from_ratio(1, 8).unwrap(), Decimal256::permille(125));
        assert_eq!(Decimal256::from_ratio(125, 1000).unwrap(), Decimal256::permille(125));

        // 1/3 (result floored)
        assert_eq!(
            Decimal256::from_ratio(1, 3).unwrap(),
            Decimal256(333_333_333_333_333_333u64.into())
        );

        // 2/3 (result floored)
        assert_eq!(
            Decimal256::from_ratio(2, 3).unwrap(),
            Decimal256(666_666_666_666_666_666u64.into())
        );
    }

    #[test]
    fn from_ratio_panics_for_zero_denominator() {
        assert_eq!(Decimal256::from_ratio(1, 0).unwrap_err(), error!(DIV: 1));
    }

    #[test]
    fn from_str_works() {
        // Integers
        assert_eq!(Decimal256::from_str("").unwrap(), Decimal256::percent(0));
        assert_eq!(Decimal256::from_str("0").unwrap(), Decimal256::percent(0));
        assert_eq!(Decimal256::from_str("1").unwrap(), Decimal256::percent(100));
        assert_eq!(Decimal256::from_str("5").unwrap(), Decimal256::percent(500));
        assert_eq!(
            Decimal256::from_str("42").unwrap(),
            Decimal256::percent(4200)
        );
        assert_eq!(Decimal256::from_str("000").unwrap(), Decimal256::percent(0));
        assert_eq!(
            Decimal256::from_str("001").unwrap(),
            Decimal256::percent(100)
        );
        assert_eq!(
            Decimal256::from_str("005").unwrap(),
            Decimal256::percent(500)
        );
        assert_eq!(
            Decimal256::from_str("0042").unwrap(),
            Decimal256::percent(4200)
        );

        // Decimal256s
        assert_eq!(
            Decimal256::from_str("1.").unwrap(),
            Decimal256::percent(100)
        );
        assert_eq!(
            Decimal256::from_str("1.0").unwrap(),
            Decimal256::percent(100)
        );
        assert_eq!(
            Decimal256::from_str("1.5").unwrap(),
            Decimal256::percent(150)
        );
        assert_eq!(
            Decimal256::from_str("0.5").unwrap(),
            Decimal256::percent(50)
        );
        assert_eq!(
            Decimal256::from_str("0.123").unwrap(),
            Decimal256::permille(123)
        );

        assert_eq!(
            Decimal256::from_str("40.00").unwrap(),
            Decimal256::percent(4000)
        );
        assert_eq!(
            Decimal256::from_str("04.00").unwrap(),
            Decimal256::percent(400)
        );
        assert_eq!(
            Decimal256::from_str("00.40").unwrap(),
            Decimal256::percent(40)
        );
        assert_eq!(
            Decimal256::from_str("00.04").unwrap(),
            Decimal256::percent(4)
        );

        // Can handle 18 fractional digits
        assert_eq!(
            Decimal256::from_str("7.123456789012345678").unwrap(),
            Decimal256(7123456789012345678u64.into())
        );
        assert_eq!(
            Decimal256::from_str("7.999999999999999999").unwrap(),
            Decimal256(7999999999999999999u64.into())
        );

        // Works for documented max value
        assert_eq!(
            Decimal256::from_str(
                "115792089237316195423570985008687907853269984665640564039457.584007913129639935"
            )
            .unwrap(),
            Decimal256::MAX
        );
    }

    #[test]
    fn from_str_errors_for_broken_whole_part() {
        match Decimal256::from_str(" ").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Error parsing whole"),
            e => panic!("Unexpected error: {:?}", e),
        }

        match Decimal256::from_str("-1").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Error parsing whole"),
            e => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn from_str_errors_for_broken_fractinal_part() {
        match Decimal256::from_str("1. ").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Error parsing fractional"),
            e => panic!("Unexpected error: {:?}", e),
        }

        match Decimal256::from_str("1.e").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Error parsing fractional"),
            e => panic!("Unexpected error: {:?}", e),
        }

        match Decimal256::from_str("1.2e3").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Error parsing fractional"),
            e => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn from_str_errors_for_more_than_18_fractional_digits() {
        match Decimal256::from_str("7.1234567890123456789").unwrap_err() {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "Cannot parse more than 18 fractional digits")
            }
            e => panic!("Unexpected error: {:?}", e),
        }

        // No special rules for trailing zeros. This could be changed but adds gas cost for the happy path.
        match Decimal256::from_str("7.1230000000000000000").unwrap_err() {
            StdError::GenericErr { msg, .. } => {
                assert_eq!(msg, "Cannot parse more than 18 fractional digits")
            }
            e => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn from_str_errors_for_invalid_number_of_dots() {
        match Decimal256::from_str("1.2.3").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Unexpected number of dots"),
            e => panic!("Unexpected error: {:?}", e),
        }

        match Decimal256::from_str("1.2.3.4").unwrap_err() {
            StdError::GenericErr { msg, .. } => assert_eq!(msg, "Unexpected number of dots"),
            e => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    #[should_panic(expected = "arithmetic operation overflow")]
    fn from_str_errors_for_more_than_max_value_integer_part() {
        let _ =
            Decimal256::from_str("115792089237316195423570985008687907853269984665640564039458");
    }

    #[test]
    #[should_panic(expected = "arithmetic operation overflow")]
    fn from_str_errors_for_more_than_max_value_integer_part_with_decimal() {
        let _ =
            Decimal256::from_str("115792089237316195423570985008687907853269984665640564039458.0");
    }
    
    #[test]
    #[should_panic(expected = "arithmetic operation overflow")]
    fn from_str_errors_for_more_than_max_value_decimal_part() {
        let _ = Decimal256::from_str(
            "115792089237316195423570985008687907853269984665640564039457.584007913129639936",
        );
    }

    #[test]
    fn is_zero_works() {
        assert!(Decimal256::zero().is_zero());
        assert!(Decimal256::percent(0).is_zero());
        assert!(Decimal256::permille(0).is_zero());

        assert!(!Decimal256::one().is_zero());
        assert!(!Decimal256::percent(123).is_zero());
        assert!(!Decimal256::permille(1234).is_zero());
    }

    #[test]
    fn add() {
        let value = (Decimal256::one() + Decimal256::percent(50)).unwrap(); // 1.5
        assert_eq!(
            value.0,
            Decimal256::DECIMAL_FRACTIONAL * U256::from(3) / U256::from(2)
        );
    }

    #[test]
    fn sub() {
        assert_eq!(
            Decimal256::percent(50),
            (Decimal256::one() - Decimal256::percent(50)).unwrap()
        );
    }

    #[test]
    fn mul() {
        assert_eq!(
            Decimal256::percent(25),
            (Decimal256::percent(50) * Decimal256::percent(50)).unwrap()
        );
    }

    #[test]
    fn div() {
        assert_eq!(
            Decimal256::one() + Decimal256::one(),
            Decimal256::percent(50) / Decimal256::percent(25)
        );
    }

    #[test]
    fn to_string() {
        // Integers
        assert_eq!(Decimal256::zero().to_string(), "0");
        assert_eq!(Decimal256::one().to_string(), "1");
        assert_eq!(Decimal256::percent(500).to_string(), "5");

        // Decimal256s
        assert_eq!(Decimal256::percent(125).to_string(), "1.25");
        assert_eq!(Decimal256::percent(42638).to_string(), "426.38");
        assert_eq!(Decimal256::percent(1).to_string(), "0.01");
        assert_eq!(Decimal256::permille(987).to_string(), "0.987");

        assert_eq!(Decimal256(1u64.into()).to_string(), "0.000000000000000001");
        assert_eq!(Decimal256(10u64.into()).to_string(), "0.00000000000000001");
        assert_eq!(Decimal256(100u64.into()).to_string(), "0.0000000000000001");
        assert_eq!(Decimal256(1000u64.into()).to_string(), "0.000000000000001");
        assert_eq!(Decimal256(10000u64.into()).to_string(), "0.00000000000001");
        assert_eq!(Decimal256(100000u64.into()).to_string(), "0.0000000000001");
        assert_eq!(Decimal256(1000000u64.into()).to_string(), "0.000000000001");
        assert_eq!(Decimal256(10000000u64.into()).to_string(), "0.00000000001");
        assert_eq!(Decimal256(100000000u64.into()).to_string(), "0.0000000001");
        assert_eq!(Decimal256(1000000000u64.into()).to_string(), "0.000000001");
        assert_eq!(Decimal256(10000000000u64.into()).to_string(), "0.00000001");
        assert_eq!(Decimal256(100000000000u64.into()).to_string(), "0.0000001");
        assert_eq!(Decimal256(10000000000000u64.into()).to_string(), "0.00001");
        assert_eq!(Decimal256(100000000000000u64.into()).to_string(), "0.0001");
        assert_eq!(Decimal256(1000000000000000u64.into()).to_string(), "0.001");
        assert_eq!(Decimal256(10000000000000000u64.into()).to_string(), "0.01");
        assert_eq!(Decimal256(100000000000000000u64.into()).to_string(), "0.1");
    }

    #[test]
    fn serialize() {
        assert_eq!(to_vec(&Decimal256::zero()).unwrap(), br#""0""#);
        assert_eq!(to_vec(&Decimal256::one()).unwrap(), br#""1""#);
        assert_eq!(to_vec(&Decimal256::percent(8)).unwrap(), br#""0.08""#);
        assert_eq!(to_vec(&Decimal256::percent(87)).unwrap(), br#""0.87""#);
        assert_eq!(to_vec(&Decimal256::percent(876)).unwrap(), br#""8.76""#);
        assert_eq!(to_vec(&Decimal256::percent(8765)).unwrap(), br#""87.65""#);
    }

    #[test]
    fn deserialize() {
        assert_eq!(
            from_slice::<Decimal256>(br#""0""#).unwrap(),
            Decimal256::zero()
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""1""#).unwrap(),
            Decimal256::one()
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""000""#).unwrap(),
            Decimal256::zero()
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""001""#).unwrap(),
            Decimal256::one()
        );

        assert_eq!(
            from_slice::<Decimal256>(br#""0.08""#).unwrap(),
            Decimal256::percent(8)
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""0.87""#).unwrap(),
            Decimal256::percent(87)
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""8.76""#).unwrap(),
            Decimal256::percent(876)
        );
        assert_eq!(
            from_slice::<Decimal256>(br#""87.65""#).unwrap(),
            Decimal256::percent(8765)
        );
    }

    #[test]
    fn round() {
        let number = Decimal256::from_str("100").unwrap();
        assert_eq!(number.round(), Uint256::from(100));

        let number = Decimal256::from_str("100.4").unwrap();
        assert_eq!(number.round(), Uint256::from(100));

        let number = Decimal256::from_str("20.3").unwrap();
        assert_eq!(number.round(), Uint256::from(20));

        let raw = Uint256::from(123 * 10u128.pow(18));
        let number = Decimal256::try_from(raw).unwrap();
        assert_eq!(number.round(), Uint256::from(raw));
    }
}

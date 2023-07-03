use crate::cosmwasm_std::{StdResult, Uint256};

/// Convert between tokens with different decimals.
///
/// # Arguments
///
/// * `amount` - the amount of input token to convert
/// * `rate` - corresponds to the output token decimals. E.g: If we want 1:1 rate and the output token has 6 decimals, then rate = 1_000_000
/// * `input_decimals` - the number of decimals of the input token
/// * `output_decimals` - the number of decimals of the output token
/// 
/// # Examples
/// 
/// Assuming the user friendly (in the UI) exchange rate has been set to
/// 1 output_token (9 decimals) == 1.5 input_token (6 decimals):
/// the rate would be 1 / 1.5 = 0.(6) or 666666666 (0.(6) ** 10 * 9)
/// meaning the price for 1 output_token is
/// 1500000000 (1.5 * 10 ** 9 decimals) of input_token.
/// 
/// If we want to get 2 of output_token, we need to send 3 input_token
/// i.e. amount = 3000000000 (3 * 10 ** 9 decimals)
/// 
/// ```
/// use fadroma::tokens::convert;
/// use fadroma::cosmwasm_std::Uint256;
/// 
/// let rate = 666_666_666u32;
/// let amount = 3_000_000u32;
///
/// let result = convert(amount, rate, 6, 9).unwrap();
/// assert_eq!(result, Uint256::from(1_999_999_998u32));
/// ```
pub fn convert(
    amount: impl Into<Uint256>,
    rate: impl Into<Uint256>,
    input_decimals: u8,
    output_decimals: u8
) -> StdResult<Uint256> {
    // result = amount * rate / one whole output token
    let amount: Uint256 = amount.into();
    let rate: Uint256 = rate.into();

    let result = amount.checked_mul(rate)?;

    // But if tokens have different number of decimals, we need to compensate either by 
    // dividing or multiplying (depending on which token has more decimals) by the difference.
    // However, we can combine this and the last operation by simply dividing by the input decimals
    // if there is a difference.
    let compensation = if input_decimals == output_decimals {
        output_decimals
    } else {
        input_decimals
    };

    let whole_token = Uint256::from(one_token(compensation));
    let result = Uint256::from(result / whole_token);

    Ok(result)
}

/// Get the amount needed to represent 1 whole token given its decimals.
/// 
/// # Examples
/// 
/// ```
/// use fadroma::prelude::one_token;
/// 
/// let one_scrt = one_token(6);
/// assert_eq!(one_scrt, 1_000_000);
/// ```
#[inline]
pub const fn one_token(decimals: u8) -> u128 {
    10u128.pow(decimals as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_token() {
        let rate = 666_666_666u32;
        let amount = 3_000_000_000u32;

        let result = convert(amount, rate, 9, 9).unwrap();
        assert_eq!(result, Uint256::from_u128(1_999_999_998));

        // Should work the same even if input_token has less decimals (ex. 6)
        // Here amount has 3 zeroes less because input_token now has 6 decimals, so
        // 1 input_token = 3000000 (3 * 10 ** 6)

        let rate = 666_666_666u32;
        let amount = 3_000_000u32;

        let result = convert(amount, rate, 6, 9).unwrap();
        assert_eq!(result, Uint256::from_u128(1_999_999_998));

        // And the other way around - when swap_token has 6 decimals.
        // Here the rate and result have 3 less digits - to account for the less decimals

        let rate = 666_666u32;
        let amount = 3_000_000_000u32;

        let result = convert(amount, rate, 9, 6).unwrap();
        assert_eq!(result, Uint256::from_u128(1_999_998));

        let rate = 150000000u32;
        let amount = 5 * one_token(18);

        let result = convert(amount, rate, 18, 8).unwrap();
        assert_eq!(result, Uint256::from_u128(7_5_000_000_0));

        let rate = 15 * one_token(17); // 1.5
        let amount = 5 * one_token(8);

        let result = convert(amount, rate, 8, 18).unwrap();
        assert_eq!(result, Uint256::from_u128(75 * one_token(17))); // 7.5
    }
}

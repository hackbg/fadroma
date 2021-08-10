use crate::{scrt::*, scrt_utils_uint256::Uint256};

/// Convert between tokens with different decimals.
///
/// # Arguments
///
/// * `amount` - the amount of the input token to convert
/// * `rate` - corresponds to the output token decimals. E.g: If we want 1:1 rate and the output token has 6 decimals, then rate = 1_000_000
/// * `input_decimals` - the number of decimals of the input token
/// * `output_decimals` - the number of decimals of the output token
pub fn convert_token(
    amount: u128,
    rate: u128,
    input_decimals: u8,
    output_decimals: u8
) -> StdResult<u128> {
    // result = amount * rate / one whole output token
 
    let amount = Uint256::from(amount);
    let rate = Uint256::from(rate);

    let mut result = (amount * rate)?;

    // But, if tokens have different number of decimals, we need to compensate either by 
    // dividing or multiplying (depending on which token has more decimals) the difference
    if input_decimals < output_decimals {
        let compensation = one_token(
            output_decimals - input_decimals
        );

        result = (result * Uint256::from(compensation))?;
    } else if output_decimals < input_decimals {
        let compensation = one_token(
            input_decimals - output_decimals
        );

        result = (result / Uint256::from(compensation))?;
    }

    let whole_token = Uint256::from(one_token(output_decimals));
    let result = (result / whole_token)?;

    result.clamp_u128()
}

/// Get the amount needed to represent 1 whole token given its decimals.
/// Ex. Given token A that has 3 decimals, 1 A == 1000
#[inline]
pub fn one_token(decimals: u8) -> u128 {
    1 * 10u128.pow(decimals.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_token() {
        // Assuming the user friendly (in the UI) exchange rate has been set to
        // 1 swapped_token (9 decimals) == 1.5 input_token (9 decimals):
        // the rate would be 1 / 1.5 = 0.(6) or 666666666 (0.(6) ** 10 * 9)
        // meaning the price for 1 whole swapped_token is
        // 1500000000 (1.5 * 10 ** 9 decimals) of input_token.

        // If we want to get 2 of swapped_token, we need to send 3 input_token
        // i.e. amount = 3000000000 (3 * 10 ** 9 decimals)

        let rate = 666_666_666;
        let amount = 3_000_000_000;

        let result = convert_token(amount, rate, 9, 9).unwrap();
        assert_eq!(result, 1_999_999_998);

        // Should work the same even if input_token has less decimals (ex. 6)
        // Here amount has 3 zeroes less because input_token now has 6 decimals, so
        // 1 input_token = 3000000 (3 * 10 ** 6)

        let rate = 666_666_666;
        let amount = 3_000_000;

        let result = convert_token(amount, rate, 6, 9).unwrap();
        assert_eq!(result, 1_999_999_998);

        // And the other way around - when swap_token has 6 decimals.
        // Here the rate and result have 3 less digits - to account for the less decimals

        let rate = 666_666;
        let amount = 3_000_000_000;

        let result = convert_token(amount, rate, 9, 6).unwrap();
        assert_eq!(result, 1_999_998);
    }
}

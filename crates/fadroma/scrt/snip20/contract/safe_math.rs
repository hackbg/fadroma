//! Math functions that prevent balance guessing attacks.

use crate::cosmwasm_std::Uint128;

/// Increases `balance` by `amount` and returns the actual amount added.
/// The return value will always be equal to `amount` **unless** it overflowed.
/// 
/// # Examples
/// 
/// ```
/// # use fadroma::{
/// #     cosmwasm_std::Uint128,
/// #     scrt::snip20::contract::safe_math::safe_add   
/// # };
/// let mut balance = Uint128::MAX - Uint128::new(2);
/// let actual_added = safe_add(&mut balance, Uint128::one());
/// 
/// assert_eq!(actual_added, Uint128::one());
/// assert_eq!(balance, Uint128::MAX - Uint128::one());
/// 
/// // Here the add operation would overflow so we saturated to the maximum value.
/// let actual_added = safe_add(&mut balance, Uint128::new(2));
/// 
/// assert_eq!(actual_added, Uint128::one());
/// assert_eq!(balance, Uint128::MAX);
/// ```
#[inline]
#[must_use = "The return value is the actual amount added."]
pub fn safe_add(balance: &mut Uint128, amount: Uint128) -> Uint128 {
    let prev_balance = *balance;
    *balance = balance.saturating_add(amount);

    *balance - prev_balance
}

// Copied from https://github.com/enigmampc/SecretSwap/blob/master/contracts/secretswap_pair/src/u256_math.rs

pub use primitive_types::U256;

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
pub fn sqrt(y: U256) -> Option<U256> {
    let mut z = U256::from(0);
    if y.gt(&U256::from(3)) {
        z = y.clone();
        let mut x = y.checked_div(U256::from(2))?.checked_add(U256::from(1))?;
        while x.lt(&z) {
            z = x.clone();
            x = y
                .checked_div(x)?
                .checked_add(x)?
                .checked_div(U256::from(2))?;
        }
    } else if !y.is_zero() {
        z = U256::from(1);
    }

    return Some(z);
}

pub fn sub(a: Option<U256>, b: Option<U256>) -> Option<U256> {
    match b {
        Some(b) => a.and_then(checked_sub(b)),
        None => None,
    }
}

pub fn div(nom: Option<U256>, denom: Option<U256>) -> Option<U256> {
    match denom {
        Some(denom) => nom.and_then(checked_div(denom)),
        None => None,
    }
}

pub fn add(a: Option<U256>, b: Option<U256>) -> Option<U256> {
    match b {
        Some(b) => a.and_then(checked_add(b)),
        None => None,
    }
}

pub fn mul(a: Option<U256>, b: Option<U256>) -> Option<U256> {
    match b {
        Some(b) => a.and_then(checked_mul(b)),
        None => None,
    }
}

fn checked_sub(b: U256) -> impl Fn(U256) -> Option<U256> {
    move |a: U256| a.checked_sub(b)
}

fn checked_div(denom: U256) -> impl Fn(U256) -> Option<U256> {
    move |nom: U256| nom.checked_div(denom)
}

fn checked_add(b: U256) -> impl Fn(U256) -> Option<U256> {
    move |a: U256| a.checked_add(b)
}

fn checked_mul(b: U256) -> impl Fn(U256) -> Option<U256> {
    move |a: U256| a.checked_mul(b)
}

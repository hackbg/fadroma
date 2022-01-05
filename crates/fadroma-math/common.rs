macro_rules! error {
    (OVERFLOW: $lhs:expr, $op:expr, $rhs:expr) => {
        error!(format!("Overflow when calculating {} {} {}", $lhs, $op, $rhs))
    };
    (UNDERFLOW: $lhs:expr, $op:expr, $rhs:expr) => {
        error!(format!("Underflow when calculating {} {} {}", $lhs, $op, $rhs))
    };
    (DIV: $lhs:expr) => {
        error!(format!("Trying to divide {} by 0", $lhs))
    };
    ($msg:expr) => {
        StdError::generic_err($msg)
    };
}

macro_rules! impl_common_api {
    () => {
        pub const MAX: Self = Self(primitive_types::U256::MAX);

        #[inline]
        pub const fn zero() -> Self {
            Self(primitive_types::U256::zero())
        }

        #[inline]
        pub fn is_zero(&self) -> bool {
            self.0.is_zero()
        }
    
        #[inline]
        pub fn checked_div(self, rhs: Self) -> StdResult<Self> {
            self / rhs
        }
    
        #[inline]
        pub fn checked_mul(self, rhs: Self) -> StdResult<Self> {
            self * rhs
        }
    
        #[inline]
        pub fn checked_sub(self, rhs: Self) -> StdResult<Self> {
            self - rhs
        }
    
        #[inline]
        pub fn checked_add(self, rhs: Self) -> StdResult<Self> {
            self + rhs
        }
    }
}

pub(crate) use error;
pub(crate) use impl_common_api;

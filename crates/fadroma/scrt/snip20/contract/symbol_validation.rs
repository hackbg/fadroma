use std::{fmt::{self, Write}, ops::RangeInclusive};

use crate::cosmwasm_std::{StdResult, StdError};

/// Defines the allowed range of name for the token and
/// the allowed constraints for its symbol according to [`SymbolValidation`].
/// 
/// Defaults:
///  - Name: From 3 to 30 (inclusive) characters allowed.
///  - Symbol: Only upper case letters in the range from 3 to 6 (inclusive) allowed.
#[derive(Clone, Debug)]
pub struct TokenValidation {
    pub name_range: RangeInclusive<usize>,
    pub symbol: SymbolValidation
}

/// Defines the length, letter casing and any special characters
/// that are allowed as the symbol for the token.
/// 
/// By default allows only upper case letters with the length being
/// from 3 to 6 characters inclusive.
#[derive(Clone, Debug)]
pub struct SymbolValidation {
    pub length: RangeInclusive<usize>,
    pub allow_upper: bool,
    pub allow_lower: bool,
    pub allow_numeric: bool,
    pub allowed_special: Option<Vec<u8>>,
}

impl TokenValidation {
    pub fn assert_is_valid(&self, name: &str, symbol: &str) -> StdResult<()> {
        if self.name_range.contains(&name.len()) &&
            self.symbol.is_valid(symbol) {
            return Ok(());
        }

        Err(StdError::generic_err(format!(
            "Expecting the token name to be between {}-{} characters and the token symbol in the following format: {}",
            self.name_range.start(),
            self.name_range.end(),
            self.symbol
        )))
    }
}

impl SymbolValidation {
    pub fn is_valid(&self, symbol: &str) -> bool {
        let len_is_valid = self.length.contains(&symbol.len());

        if len_is_valid {
            let mut cond = Vec::new();
    
            if self.allow_upper {
                cond.push(b'A'..=b'Z');
            }
    
            if self.allow_lower {
                cond.push(b'a'..=b'z');
            }
    
            if self.allow_numeric {
                cond.push(b'0'..=b'9');
            }
    
            let special: &[u8] = self.allowed_special.as_deref().unwrap_or(&[]);
    
            let valid = symbol
                .bytes()
                .all(|x| cond.iter().any(|c| c.contains(&x) || special.contains(&x)));
    
            if valid {
                return true;
            }
        }
    
        false
    }
}

impl Default for TokenValidation {
    fn default() -> Self {
        Self {
            name_range: 3..=30,
            symbol: SymbolValidation::default()
        }
    }
}

impl Default for SymbolValidation {
    fn default() -> Self {
        Self {
            length: 3..=6,
            allow_upper: true,
            allow_lower: false,
            allow_numeric: false,
            allowed_special: None
        }
    }
}

impl fmt::Display for SymbolValidation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_fmt(format_args!(
            "{{{} - {}}}",
            self.length.start(),
            self.length.end()
        ))?;

        if self.allow_upper {
            f.write_str(" [A-Z]")?;
        }

        if self.allow_lower {
            f.write_str(" [a-z]")?;
        }

        if self.allow_numeric {
            f.write_str(" [0-9]")?;
        }

        if let Some(chars) = self.allowed_special.clone() {
            f.write_str(" [")?;

            for c in chars {
                f.write_char(c.into())?;
                f.write_char(',')?;
            }

            f.write_char(']')?;
        }

        Ok(())
    }
}

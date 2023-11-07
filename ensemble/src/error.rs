use std::fmt::{Debug, Display};

use fadroma::cosmwasm_std::StdError;

#[derive(Debug)]
pub enum EnsembleError {
    ContractError(anyhow::Error),
    ContractRegistry(RegistryError),
    AttributeValidation(String),
    Bank(String),
    Staking(String),
    Std(StdError)
}

#[derive(Clone, PartialEq, Debug)]
pub enum RegistryError {
    NotFound(String),
    IdNotFound(u64),
    DuplicateAddress(String),
    InvalidCodeHash(String),
}

#[derive(Clone, PartialEq, Debug)]
pub enum AttributeError {
    EventTypeTooShort(String),
    KeyReserved(String),
    EmtpyKey(String),
    EmtpyValue(String),
}

impl EnsembleError {
    /// Returns the error that the executed contract returned.
    /// Panics if not a contract error.
    #[inline]
    pub fn unwrap_contract_error(self) -> anyhow::Error {
        match self {
            Self::ContractError(err) => err,
            _ => panic!("called EnsembleError::unwrap_contract_error() on a non EnsembleError::ContractError")
        }
    }

    /// Returns `true` if the error occurred within the contract.
    /// `false` otherwise.
    #[inline]
    pub fn is_contract_error(&self) -> bool {
        matches!(self, EnsembleError::ContractError(_))
    }

    #[inline]
    pub(crate) fn registry(err: RegistryError) -> Self {
        Self::ContractRegistry(err)
    }
}

impl From<StdError> for EnsembleError {
    fn from(err: StdError) -> Self {
        Self::Std(err)
    }
}

impl From<anyhow::Error> for EnsembleError {
    fn from(err: anyhow::Error) -> Self {
        Self::ContractError(err)
    }
}

impl Display for EnsembleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Bank(msg) => f.write_fmt(format_args!("Ensemble error - Bank: {}", msg)),
            Self::Staking(msg) => f.write_fmt(format_args!("Ensemble error - Staking: {}", msg)),
            Self::ContractRegistry(err) => f.write_fmt(format_args!("Ensemble error - Contract registry: {}", err.to_string())),
            Self::AttributeValidation(msg) => f.write_fmt(format_args!("Ensemble error - Event attribute validation: {}", msg)),
            Self::Std(err) => Display::fmt(err, f),
            Self::ContractError(err) => Display::fmt(err, f)
        }
    }
}

impl Display for RegistryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(address) => f.write_fmt(format_args!("Contract address {} not found", address)),
            Self::DuplicateAddress(address) => f.write_fmt(format_args!("Contract instance with address {} already exists", address)),
            Self::IdNotFound(id) => f.write_fmt(format_args!("Contract with id {} not found", id)),
            Self::InvalidCodeHash(hash) => f.write_fmt(format_args!("Contract code hash {} is invalid", hash)),
        }
    }
}

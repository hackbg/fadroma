use serde::{Deserialize, Serialize};
use fadroma::schemars::{self, JsonSchema};
use fadroma::cosmwasm_std::{Addr, Coin};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MockEnv {
    pub sent_funds: Vec<Coin>,
    pub(crate) sender: Addr,
    pub(crate) contract: Addr
}

impl MockEnv {
    /// The maximum length that the address is allowed to be.
    /// We want to be consistent with how `cosmwasm_std::testing::MockApi`
    /// works which is what the ensemble uses internally.
    /// Otherwise if you canonize any addresses longer than that you will
    /// get a cryptic error telling that your address is too long but
    /// not exactly how much longer. This detail is intentionally hidden
    /// in CosmWasm but there is no reason for you not to know in tests,
    /// because if you ran into that error you'd just have to guess anyways...
    /// so we tell you.
    pub const MAX_ADDRESS_LEN: usize = 54;

    /// Constructs a new instance of [`MockEnv`].
    /// 
    /// # Arguments
    ///
    /// * `sender` - The address that executes the contract i.e `info.sender`.
    /// * `contract` - The address of the contract to be executed/instantiated i.e `env.contract.address`.
    /// 
    /// # Panics
    /// 
    /// Panics if either the `sender` or `contract` arguments are longer than 
    /// [`MockEnv::MAX_ADDRESS_LEN`] bytes or have upper case letters.
    /// 
    /// We do this in order to respect how `cosmwasm_std::testing::MockApi` works which
    /// we use internally. This way we avoid any inconsistencies when you set an address that
    /// has upper case letters but then it gets canonicalized and becomes all lower case.
    pub fn new(sender: impl Into<String>, contract: impl Into<String>) -> Self {
        let sender = sender.into();
        let contract = contract.into();

        if !is_valid_address(&sender) || !is_valid_address(&contract) {
            panic!(
                "Addresses must be at most {} bytes long and have all lower case characters.",
                MockEnv::MAX_ADDRESS_LEN
            );
        }

        Self {
            sender: Addr::unchecked(sender),
            contract: Addr::unchecked(contract),
            sent_funds: vec![]
        }
    }

    /// Any funds that the sender is transferring to the executed contract.
    /// i.e `info.funds`.
    #[inline]
    pub fn sent_funds(mut self, funds: Vec<Coin>) -> Self {
        self.sent_funds = funds;

        self
    }

    #[inline]
    pub fn sender(&self) -> &str {
        self.sender.as_str()
    }

    #[inline]
    pub fn contract(&self) -> &str {
        self.contract.as_str()
    }

    pub(crate) fn new_sanitized(
        sender: impl Into<String>,
        contract: impl Into<String>
    ) -> Self {
        let sender = sender.into();
        assert!(is_valid_address(&sender));

        let mut contract = contract.into();
        contract.truncate(Self::MAX_ADDRESS_LEN);

        Self {
            sender: Addr::unchecked(sender),
            contract: Addr::unchecked(contract.to_lowercase()),
            sent_funds: vec![]
        }
    }
}

#[inline]
fn is_valid_address(addr: &str) -> bool {
    addr.len() <= MockEnv::MAX_ADDRESS_LEN &&
        addr.to_lowercase() == addr
}

#[cfg(test)]
mod tests {
    use crate::cosmwasm_std::{testing::MockApi, Api};
    use super::*;

    // If this test fails it probably means that the MockApi
    // logic in CosmWasm has changed. In that case, adjust
    // MockEnv::MAX_ADDRESS_LEN accordingly.
    #[test]
    fn verify_cw_mock_api_max_len() {
        let addr = "a".repeat(MockEnv::MAX_ADDRESS_LEN + 1);

        let api = MockApi::default();
        api.addr_canonicalize(&addr).unwrap_err();
        api.addr_canonicalize(&addr[0..addr.len() - 1]).unwrap();
    }

    #[test]
    fn verify_cw_mock_api_converts_to_lowercase() {
        let addr = "A".repeat(MockEnv::MAX_ADDRESS_LEN);

        let api = MockApi::default();
        let canon = api.addr_canonicalize(&addr).unwrap();
        assert!(canon.0.iter().all(|x| *x == 97));

        let human = api.addr_humanize(&canon).unwrap();
        assert!(human.as_bytes().iter().all(|x| *x == 97));

        assert!(is_valid_address(human.as_str()));
    }

    #[test]
    fn mock_env_respects_mock_api() {
        let addr = "A".repeat(MockEnv::MAX_ADDRESS_LEN + 1);
        assert!(!is_valid_address(&addr));

        let env = MockEnv::new_sanitized("sender", addr);
        assert_eq!(env.sender.as_str(), "sender");
        assert_eq!(env.contract.as_str(), "a".repeat(MockEnv::MAX_ADDRESS_LEN));

        assert!(is_valid_address(env.sender.as_str()));
        assert!(is_valid_address(env.contract.as_str()));
    }

    #[test]
    fn addresses_can_contain_spaces_and_special_characters() {
        MockEnv::new("`~123!@#$%^&*()-=+\\/.,<>?[]{}", "this address has spaces");
    }
}

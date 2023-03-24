use std::ops::Deref;

use crate::{
    self as fadroma,
    storage::Segment,
    scrt::snip20::client::interface::TokenConfig,
    prelude::{
        BlockInfo, CanonicalAddr, StdResult, Storage, Uint128,
        ViewingKey, ViewingKeyHashed, SingleItem, ItemSpace,
        TypedKey, TypedKey2, FadromaSerialize, FadromaDeserialize
    }
};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

crate::namespace!(pub ConstantsNs, b"N3QP0mNoPG");
pub const CONSTANTS: SingleItem<Constants, ConstantsNs> = SingleItem::new();

crate::namespace!(pub PrngSeedNs, b"Lwr3sTJZmk");
pub const PRNG_SEED: SingleItem<[u8; 32], PrngSeedNs> = SingleItem::new();

crate::namespace!(pub TotalSupplyNs, b"bx98UUOWYa");
pub const TOTAL_SUPPLY: TotalSupplyStore = TotalSupplyStore(SingleItem::new());

crate::namespace!(pub MintersNs, b"wpitCjS7wB");
pub const MINTERS: MintersStore = MintersStore(SingleItem::new());

#[doc(hidden)]
pub struct MintersStore(pub SingleItem<Vec<CanonicalAddr>, MintersNs>);

#[doc(hidden)]
pub struct TotalSupplyStore(pub SingleItem<Uint128, TotalSupplyNs>);

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, PartialEq, JsonSchema, Debug)]
pub struct Constants {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub token_settings: TokenSettings
}

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, Copy, JsonSchema, PartialEq, Default, Debug)]
pub struct TokenSettings(u8);

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TokenPermission {
    PublicTotalSupply = 1 << 0,
    Deposit = 1 << 1,
    Redeem = 1 << 2,
    Mint = 1 << 3,
    Burn = 1 << 4
}

crate::namespace!(BalancesNs, b"DyCKbmlEL8");
crate::namespace!(AllowancesNs, b"eXDXajOxRG");
crate::namespace!(ViewingKeyNs, b"MLRCoHCV8x");
crate::namespace!(ReceierHashNs, b"V1SJqXtGju");

#[derive(PartialEq, Debug)]
pub struct Account {
    addr: CanonicalAddr
}

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, PartialEq, Default, JsonSchema, Debug)]
pub struct Allowance {
    pub amount: Uint128,
    pub expiration: Option<u64>
}

impl Allowance {
    pub fn is_expired_at(&self, block: &BlockInfo) -> bool {
        match self.expiration {
            Some(time) => block.time.seconds() >= time,
            None => false
        }
    }
}

impl TotalSupplyStore {
    #[inline]
    pub fn increase(&self, storage: &mut dyn Storage, amount: Uint128) -> StdResult<()> {
        let total_supply = self.load_or_default(storage)?;
        let new_total = total_supply.checked_add(amount)?;

        self.save(storage, &new_total)
    }

    #[inline]
    pub fn decrease(&self, storage: &mut dyn Storage, amount: Uint128) -> StdResult<()> {
        let total_supply = self.load_or_default(storage)?;
        let new_total = total_supply.checked_sub(amount)?;

        self.save(storage, &new_total)
    }
}

impl MintersStore {
    #[inline]
    pub fn add(
        &self,
        storage: &mut dyn Storage,
        new_minters: Vec<CanonicalAddr>,
    ) -> StdResult<()> {
        let mut minters = self.load_or_default(storage)?;
        minters.extend(new_minters);

        self.save(storage, &minters)
    }

    #[inline]
    pub fn remove_minters(
        &self,
        storage: &mut dyn Storage,
        to_remove: Vec<CanonicalAddr>,
    ) -> StdResult<()> {
        let mut minters = self.load_or_default(storage)?;

        for minter in to_remove {
            minters.retain(|x| *x != minter);
        }

        self.save(storage, &minters)
    }
}

impl Deref for MintersStore {
    type Target = SingleItem<Vec<CanonicalAddr>, MintersNs>;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Deref for TotalSupplyStore {
    type Target = SingleItem<Uint128, TotalSupplyNs>;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[doc(hidden)]
impl Segment for Account {
    fn size(&self) -> usize {
        self.addr.len()
    }

    fn write_segment(&self, buf: &mut Vec<u8>) {
        buf.extend_from_slice(&self.addr);
    }
}

impl Account {
    const BALANCE: ItemSpace<
        Uint128,
        BalancesNs,
        TypedKey<'_, Self>
    > = ItemSpace::new();

    const ALLOWANCE: ItemSpace<
        Allowance,
        AllowancesNs,
        TypedKey2<'_, Self, CanonicalAddr>
    > = ItemSpace::new();

    const VIEWING_KEY: ItemSpace<
        ViewingKeyHashed,
        ViewingKeyNs,
        TypedKey<'_, Self>
    > = ItemSpace::new();

    const RECEIVER: ItemSpace<
        String,
        ReceierHashNs,
        TypedKey<'_, Self>
    > = ItemSpace::new();

    #[inline]
    pub fn of(addr: CanonicalAddr) -> Self {
        Self { addr }
    }

    #[inline]
    pub fn addr(&self) -> &CanonicalAddr {
        &self.addr
    }

    #[inline]
    pub fn balance(&self, storage: &dyn Storage) -> StdResult<Uint128> {
        Self::BALANCE.load_or_default(storage, self)
    }

    #[inline]
    pub fn add_balance(&self, storage: &mut dyn Storage, amount: Uint128) -> StdResult<()> {
        let account_balance = self.balance(storage)?;
        let new_balance = account_balance.checked_add(amount)?;

        Self::BALANCE.save(storage, self, &new_balance)
    }

    #[inline]
    pub fn subtract_balance(&self, storage: &mut dyn Storage, amount: Uint128) -> StdResult<()> {
        let account_balance = self.balance(storage)?;
        let new_balance = account_balance.checked_sub(amount)?;

        Self::BALANCE.save(storage, self, &new_balance)
    }

    pub fn update_allowance<F>(
        &self,
        storage: &mut dyn Storage,
        spender: &CanonicalAddr,
        func: F
    ) -> StdResult<Allowance>
    where
        F: FnOnce(&mut Allowance) -> StdResult<()>,
    {
        let key = (self, spender);
        let mut allowance = Self::ALLOWANCE.load(
            storage,
            key
        )?.unwrap_or_default();

        func(&mut allowance)?;
        Self::ALLOWANCE.save(storage, key, &allowance)?;

        Ok(allowance)
    }

    #[inline]
    pub fn allowance(
        &self,
        storage: &dyn Storage,
        spender: &CanonicalAddr
    ) -> StdResult<Allowance> {
        Self::ALLOWANCE.load_or_default(
            storage,
            (self, spender)
        )
    }

    #[inline]
    pub fn viewing_key(&self, storage: &dyn Storage) -> StdResult<Option<ViewingKeyHashed>> {
        Self::VIEWING_KEY.load(storage, self)
    }

    #[inline]
    pub fn set_viewing_key(&self, storage: &mut dyn Storage, key: &ViewingKey) -> StdResult<()> {
        Self::VIEWING_KEY.save(storage, self, &key.to_hashed())
    }

    #[inline]
    pub fn receiver_hash(&self, storage: &dyn Storage) -> StdResult<Option<String>> {
        Self::RECEIVER.load(storage, self)
    }

    #[inline]
    pub fn set_receiver_hash(&self, storage: &mut dyn Storage, code_hash: String) -> StdResult<()> {
        Self::RECEIVER.save(storage, self, &code_hash)
    }
}

impl From<CanonicalAddr> for Account {
    fn from(addr: CanonicalAddr) -> Self {
        Self { addr }
    }
}

impl From<Account> for CanonicalAddr {
    fn from(account: Account) -> Self {
        account.addr
    }
}

impl TokenSettings {
    #[inline(always)]
    pub fn is_set(&self, setting: TokenPermission) -> bool {
        let setting = setting as u8;

        self.0 & setting == setting
    }

    #[inline(always)]
    fn set(&mut self, setting: TokenPermission) {
        self.0 |= setting as u8;
    }
}

impl From<TokenConfig> for TokenSettings {
    fn from(config: TokenConfig) -> Self {
        let mut s = TokenSettings::default();

        if config.public_total_supply {
            s.set(TokenPermission::PublicTotalSupply);
        }

        if config.enable_deposit {
            s.set(TokenPermission::Deposit);
        }

        if config.enable_redeem {
            s.set(TokenPermission::Redeem);
        }

        if config.enable_mint {
            s.set(TokenPermission::Mint);
        }

        if config.enable_burn {
            s.set(TokenPermission::Burn);
        }

        s
    }
}

#[cfg(test)]
mod tests {
    use super::{TokenSettings, TokenPermission};

    #[test]
    fn token_settings() {
        fn test(s: TokenSettings, e: [bool; 5]) {
            assert_eq!(s.is_set(TokenPermission::PublicTotalSupply), e[0]);
            assert_eq!(s.is_set(TokenPermission::Deposit), e[1]);
            assert_eq!(s.is_set(TokenPermission::Redeem), e[2]);
            assert_eq!(s.is_set(TokenPermission::Mint), e[3]);
            assert_eq!(s.is_set(TokenPermission::Burn), e[4]);
        }

        let mut s = TokenSettings::default();
        test(s, [false, false, false, false, false]);

        s.set(TokenPermission::PublicTotalSupply);
        s.set(TokenPermission::Redeem);

        test(s, [true, false, true, false, false]);

        s.set(TokenPermission::Deposit);
        test(s, [true, true, true, false, false]);

        s.set(TokenPermission::Mint);
        test(s, [true, true, true, true, false]);

        s.set(TokenPermission::Burn);
        test(s, [true, true, true, true, true]);

        let mut s = TokenSettings::default();

        s.set(TokenPermission::Deposit);
        s.set(TokenPermission::Mint);
        test(s, [false, true, false, true, false]);
    }
}

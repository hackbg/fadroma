use std::ops::Deref;

use crate::{
    self as fadroma,
    storage::Segment,
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

crate::namespace!(pub TotalSupplyNs, b"bx98UUOWYa");
pub const TOTAL_SUPPLY: TotalSupplyStore = TotalSupplyStore(SingleItem::new());

crate::namespace!(pub MintersNs, b"wpitCjS7wB");
pub const MINTERS: MintersStore = MintersStore(SingleItem::new());

#[doc(hidden)]
pub struct MintersStore(pub SingleItem<Vec<CanonicalAddr>, MintersNs>);

#[doc(hidden)]
pub struct TotalSupplyStore(pub SingleItem<Uint128, TotalSupplyNs>);

// Config
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, PartialEq, JsonSchema, Debug)]
pub struct Constants {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub prng_seed: Vec<u8>,
    // privacy configuration
    pub total_supply_is_public: bool,
    // is deposit enabled
    pub deposit_is_enabled: bool,
    // is redeem enabled
    pub redeem_is_enabled: bool,
    // is mint enabled
    pub mint_is_enabled: bool,
    // is burn enabled
    pub burn_is_enabled: bool
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

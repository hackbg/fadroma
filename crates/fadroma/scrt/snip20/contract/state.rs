use std::ops::Deref;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{
    self as fadroma,
    storage::{Segment, iterable::IterableStorage},
    scrt::snip20::client::{TokenConfig, GivenAllowance, ReceivedAllowance},
    cosmwasm_std::{self, BlockInfo, CanonicalAddr, StdResult, Storage, Uint128, Deps},
    prelude::{
        ViewingKey, ViewingKeyHashed, SingleItem, ItemSpace, TypedKey,
        TypedKey2, FadromaSerialize, FadromaDeserialize, Canonize, Humanize,
        Address
    },
    impl_canonize_default
};
use super::{
    safe_math::safe_add,
    decoy::Decoys
};

crate::namespace!(pub ConstantsNs, b"N3QP0mNoPG");
pub const CONSTANTS: SingleItem<Constants, ConstantsNs> = SingleItem::new();

crate::namespace!(pub PrngSeedNs, b"Lwr3sTJZmk");
pub const PRNG_SEED: SingleItem<[u8; 32], PrngSeedNs> = SingleItem::new();

crate::namespace!(pub TotalSupplyNs, b"bx98UUOWYa");
pub const TOTAL_SUPPLY: TotalSupplyStore = TotalSupplyStore(SingleItem::new());

crate::namespace!(pub MintersNs, b"wpitCjS7wB");
pub const MINTERS: MintersStore = MintersStore(SingleItem::new());

crate::namespace!(pub SupportedDenomsNs, b"OxL3tsqB9N");
pub const SUPPORTED_DENOMS: SingleItem<
    Vec<String>,
    SupportedDenomsNs
> = SingleItem::new();

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
    Burn = 1 << 4,
    ModifyDenoms = 1 << 5
}

crate::namespace!(BalancesNs, b"DyCKbmlEL8");
crate::namespace!(AllowancesNs, b"eXDXajOxRG");
crate::namespace!(AllowancesIndicesNs, b"WHzOdOcMvW");
crate::namespace!(AllowedNs, b"YjRo4tM6pC");
crate::namespace!(ViewingKeyNs, b"MLRCoHCV8x");
crate::namespace!(ReceierHashNs, b"V1SJqXtGju");

#[derive(PartialEq, Debug)]
pub struct Account {
    addr: CanonicalAddr
}

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, Copy, PartialEq, Default, JsonSchema, Debug)]
pub struct Allowance {
    pub amount: Uint128,
    pub expiration: Option<u64>
}

#[derive(FadromaSerialize, FadromaDeserialize, JsonSchema, Canonize, Debug)]
struct AllowanceEntry<A: Address> {
    spender: A,
    allowance: Allowance
}

#[derive(FadromaSerialize, FadromaDeserialize, JsonSchema, Debug)]
struct AllowedEntry {
    lender: CanonicalAddr,
    index: u64
}

impl_canonize_default!(Allowance);

impl Allowance {
    pub fn is_expired_at(&self, block: &BlockInfo) -> bool {
        match self.expiration {
            Some(time) => block.time.seconds() >= time,
            None => false
        }
    }
}

impl TotalSupplyStore {
    /// Saturates at [`Uint128::MAX`] and thus the return value is the actual amount added.
    #[inline]
    pub fn increase(&self, storage: &mut dyn Storage, amount: Uint128) -> StdResult<Uint128> {
        let mut total_supply = self.load_or_default(storage)?;
        let amount_added = safe_add(&mut total_supply, amount);

        self.save(storage, &total_supply)?;

        Ok(amount_added)
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

    const VIEWING_KEY: ItemSpace<
        ViewingKeyHashed,
        ViewingKeyNs,
        TypedKey<'_, Self>
    > = ItemSpace::new();

    const ALLOWANCES_INDICES: ItemSpace<
        u64,
        AllowancesIndicesNs,
        TypedKey2<'_, Self, Self>
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
    pub fn add_balance(
        &self,
        storage: &mut dyn Storage,
        amount: Uint128,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        match decoys {
            Some(decoys) => {
                let mut updated = false;

                for (i, decoy) in decoys.shuffle_in(self).enumerate() {
                    // Always load and save account balance to obfuscate the real account.
                    let mut balance = decoy.balance(storage)?;

                    if !updated && decoys.acc_index() == i {
                        updated = true;
                        let _ = safe_add(&mut balance, amount);
                    }

                    Self::BALANCE.save(storage, decoy, &balance)?;
                }

                Ok(())
            }
            None => {
                let mut balance = self.balance(storage)?;
                let _ = safe_add(&mut balance, amount);
        
                Self::BALANCE.save(storage, self, &balance)
            }
        }
    }

    #[inline]
    pub fn subtract_balance(
        &self,
        storage: &mut dyn Storage,
        amount: Uint128,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        match decoys {
            Some(decoys) => {
                let mut updated = false;

                for (i, decoy) in decoys.shuffle_in(self).enumerate() {
                    // Always load and save account balance to obfuscate the real account.
                    let balance = decoy.balance(storage)?;

                    let balance = if !updated && decoys.acc_index() == i {
                        updated = true;

                        balance.checked_sub(amount)?
                    } else {
                        balance
                    };

                    Self::BALANCE.save(storage, decoy, &balance)?;
                }

                Ok(())
            }
            None => {
                let balance = self.balance(storage)?;
                let new_balance = balance.checked_sub(amount)?;
        
                Self::BALANCE.save(storage, self, &new_balance)
            }
        }
    }

    pub fn update_allowance<F>(
        &self,
        storage: &mut dyn Storage,
        spender: &Self,
        func: F
    ) -> StdResult<Allowance>
    where
        F: FnOnce(Allowance) -> StdResult<Allowance>
    {
        let mut allowances = self.allowances_storage();

        let key = (self, spender);
        let result = match Self::ALLOWANCES_INDICES.load(storage, key)? {
            Some(index) =>
                allowances.update(
                    storage,
                    index,
                    |mut entry| {
                        entry.allowance = func(entry.allowance)?;

                        Ok(entry)
                    }
                )?
                .unwrap()
                .allowance,
            None => {
                let allowance = func(Allowance::default())?;
                let index = allowances.push(storage, &AllowanceEntry {
                    spender: spender.addr.clone(),
                    allowance
                })?;

                Self::ALLOWANCES_INDICES.save(storage, key, &index)?;

                let mut allowed = spender.allowed_storage();
                allowed.push(storage, &AllowedEntry {
                    lender: self.addr.clone(),
                    index
                })?;

                allowance
            }
        };

        Ok(result)
    }

    #[inline]
    pub fn allowance(
        &self,
        storage: &dyn Storage,
        spender: &Account
    ) -> StdResult<Allowance> {
        match Self::ALLOWANCES_INDICES.load(storage, (self, spender))? {
            Some(index) => {
                let allowances = self.allowances_storage();

                Ok(allowances.get(storage, index)?.unwrap().allowance)
            },
            None => Ok(Allowance::default())
        }
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

    pub fn allowances(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32
    ) -> StdResult<(Vec<GivenAllowance>, u64)> {
        let iter = self.allowances_storage().iter(deps.storage)?;
        let total_len = iter.len();

        let iter = iter
            .into_iter()
            .skip((page * page_size) as _)
            .take(page_size as _);

        let mut result = Vec::with_capacity(iter.len());

        for item in iter {
            let item = item?.humanize(deps.api)?;
            result.push(GivenAllowance {
                spender: item.spender,
                allowance: item.allowance.amount,
                expiration: item.allowance.expiration
            });
        }

        Ok((result, total_len))
    }

    pub fn received_allowances(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32
    ) -> StdResult<(Vec<ReceivedAllowance>, u64)> {
        let iter = self.allowed_storage().iter(deps.storage)?;
        let total_len = iter.len();

        let iter = iter
            .into_iter()
            .skip((page * page_size) as _)
            .take(page_size as _);

        let mut result = Vec::with_capacity(iter.len());

        for item in iter {
            let item = item?;
            let account = Self { addr: item.lender };
            
            let allowances = account.allowances_storage();
            let allowance = allowances
                .get(deps.storage, item.index)?
                .unwrap()
                .allowance;

            result.push(ReceivedAllowance {
                owner: account.addr.humanize(deps.api)?,
                allowance: allowance.amount,
                expiration: allowance.expiration
            });
        }

        Ok((result, total_len))
    }

    #[inline]
    fn allowances_storage(&self) -> IterableStorage<
        AllowanceEntry<CanonicalAddr>,
        TypedKey2<AllowancesNs, Self>
    > {
        IterableStorage::new(TypedKey2::from((&AllowancesNs, self)))
    }

    #[inline]
    fn allowed_storage(&self) -> IterableStorage<
        AllowedEntry,
        TypedKey2<AllowedNs, Self>
    > {
        IterableStorage::new(TypedKey2::from((&AllowedNs, self)))
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

        if config.enable_modify_denoms {
            s.set(TokenPermission::ModifyDenoms);
        }

        s
    }
}

#[cfg(test)]
mod tests {
    use super::{TokenSettings, TokenPermission};

    #[test]
    fn token_settings() {
        fn test(s: TokenSettings, e: [bool; 6]) {
            assert_eq!(s.is_set(TokenPermission::PublicTotalSupply), e[0]);
            assert_eq!(s.is_set(TokenPermission::Deposit), e[1]);
            assert_eq!(s.is_set(TokenPermission::Redeem), e[2]);
            assert_eq!(s.is_set(TokenPermission::Mint), e[3]);
            assert_eq!(s.is_set(TokenPermission::Burn), e[4]);
            assert_eq!(s.is_set(TokenPermission::ModifyDenoms), e[5]);
        }

        let mut s = TokenSettings::default();
        test(s, [false, false, false, false, false, false]);

        s.set(TokenPermission::PublicTotalSupply);
        s.set(TokenPermission::Redeem);

        test(s, [true, false, true, false, false, false]);

        s.set(TokenPermission::Deposit);
        test(s, [true, true, true, false, false, false]);

        s.set(TokenPermission::Mint);
        test(s, [true, true, true, true, false, false]);

        s.set(TokenPermission::Burn);
        test(s, [true, true, true, true, true, false]);

        let mut s = TokenSettings::default();

        s.set(TokenPermission::Deposit);
        s.set(TokenPermission::Mint);
        s.set(TokenPermission::ModifyDenoms);

        test(s, [false, true, false, true, false, true]);
    }
}

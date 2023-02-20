use std::ops::Deref;

use crate::{
    prelude::*,
    storage::iterable::{self, IterableStorage},
    scrt::snip20::client::msg::{Tx, RichTx, RichTxCanon, TxActionCanon}
};
use super::state::Account;

crate::namespace!(pub TxCountNs, b"n8BHFWp7eT");
pub const TX_COUNT: TxCountStore = TxCountStore(SingleItem::new());

#[doc(hidden)]
pub struct TxCountStore(pub SingleItem<u64, TxCountNs>);

crate::namespace!(TransfersNs, b"pySCWXqPR3");
crate::namespace!(TxsNs, b"POTbfDvq01");

pub fn store_transfer(
    store: &mut dyn Storage,
    owner: &Account,
    sender: &Account,
    receiver: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo
) -> StdResult<()> {
    let block_time = block.time.seconds();
    let transfer = Tx {
        id: TX_COUNT.increment(store)?,
        from: owner.addr().clone(),
        sender: sender.addr().clone(),
        receiver: receiver.addr().clone(),
        coins: Coin { denom, amount },
        memo,
        block_time: Some(block_time),
        block_height: Some(block.height)
    };

    let action = TxActionCanon::transfer(
        transfer.from.clone(),
        transfer.sender.clone(),
        transfer.receiver.clone()
    );

    let tx = RichTxCanon {
        id: transfer.id,
        action,
        coins: transfer.coins.clone(),
        memo: transfer.memo.clone(),
        block_time,
        block_height: block.height
    };

    // Write to the owners history if it's different from the other two addresses
    if owner != sender && owner != receiver {
        owner.add_tx(store, &tx)?;
        owner.add_transfer(store, &transfer)?;
    }
    // Write to the sender's history if it's different from the receiver
    if sender != receiver {
        sender.add_tx(store, &tx)?;
        sender.add_transfer(store, &transfer)?;
    }

    // Always write to the recipient's history
    receiver.add_tx(store, &tx)?;

    receiver.add_transfer(store, &transfer)
}

pub fn store_mint(
    store: &mut dyn Storage,
    minter: &Account,
    recipient: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    let action = TxActionCanon::mint(
        minter.addr().clone(),
        recipient.addr().clone()
    );
    
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        action,
        Coin { denom, amount },
        memo,
        block
    );

    if minter != recipient {
        recipient.add_tx(store, &tx)?;
    }
    
    minter.add_tx(store, &tx)
}

pub fn store_burn(
    store: &mut dyn Storage,
    owner: &Account,
    burner: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    let action = TxActionCanon::burn(
        owner.addr().clone(),
        burner.addr().clone()
    );
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        action,
        Coin { denom, amount },
        memo,
        block
    );

    if burner != owner {
        owner.add_tx(store, &tx)?;
    }

    burner.add_tx(store, &tx)
}

#[inline]
pub fn store_deposit(
    store: &mut dyn Storage,
    recipient: &Account,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
) -> StdResult<()> {
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        TxActionCanon::deposit(),
        Coin { denom, amount },
        None,
        block
    );

    recipient.add_tx(store, &tx)
}

#[inline]
pub fn store_redeem(
    store: &mut dyn Storage,
    redeemer: &Account,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
) -> StdResult<()> {
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        TxActionCanon::redeem(),
        Coin { denom, amount },
        None,
        block
    );

    redeemer.add_tx(store, &tx)
}

impl Account {
    #[inline]
    pub fn add_tx(
        &self,
        storage: &mut dyn Storage,
        tx: &RichTxCanon
    ) -> StdResult<()> {
        let mut txs = self.txs_storage();
        txs.push(storage, tx)?;

        Ok(())
    }

    #[inline]
    pub fn add_transfer(
        &self,
        storage: &mut dyn Storage,
        tx: &Tx<CanonicalAddr>
    ) -> StdResult<()> {
        let mut transfers = self.transfers_storage();
        transfers.push(storage, tx)?;

        Ok(())
    }

    #[inline]
    pub fn txs(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32
    ) -> StdResult<(Vec<RichTx>, u64)> {
        let iter = self.txs_storage().iter(deps.storage)?;
        
        pages(iter, deps.api, page, page_size)
    }

    #[inline]
    pub fn transfers(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32
    ) -> StdResult<(Vec<Tx<Addr>>, u64)> {
        let iter = self.transfers_storage().iter(deps.storage)?;

        pages(iter, deps.api, page, page_size)
    }

    #[inline]
    fn txs_storage(&self) -> IterableStorage<
        RichTxCanon,
        TypedKey2<TxsNs, Self>
    > {
        IterableStorage::new(TypedKey2::from((&TxsNs, self)))
    }

    #[inline]
    fn transfers_storage(&self) -> IterableStorage<
        Tx<CanonicalAddr>,
        TypedKey2<TransfersNs, Self>
    > {
        IterableStorage::new(TypedKey2::from((&TransfersNs, self)))
    }
}

fn pages<'a, T: FadromaSerialize + FadromaDeserialize + Humanize>(
    iter: iterable::Iter<'a, T>,
    api: &dyn Api,
    page: u32,
    page_size: u32
) -> StdResult<(Vec<<T as Humanize>::Output>, u64)>  {
    let len = iter.len();
    let iter = iter
        .into_iter()
        .rev()
        .skip((page * page_size) as _)
        .take(page_size as _);

    let mut result = Vec::with_capacity(iter.len());

    for item in iter {
        result.push(item?.humanize(api)?);
    }

    Ok((result, len))
}

impl RichTxCanon {
    #[inline]
    fn new(
        id: u64,
        action: TxActionCanon,
        coins: Coin,
        memo: Option<String>,
        block: &BlockInfo
    ) -> Self {
        Self {
            id,
            action,
            coins,
            memo,
            block_time: block.time.seconds(),
            block_height: block.height
        }
    }
}

impl TxCountStore {
    #[inline]
    pub fn increment(&self, storage: &mut dyn Storage) -> StdResult<u64> {
        let count = self.load_or_default(storage)? + 1;
        self.save(storage, &count)?;

        Ok(count)
    }
}

impl Deref for TxCountStore {
    type Target = SingleItem<u64, TxCountNs>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

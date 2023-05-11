use std::ops::Deref;

use crate::{
    prelude::*,
    storage::iterable::{self, IterableStorage},
    scrt::snip20::client::{Tx, RichTx, RichTxCanon, TxActionCanon, TxCode}
};
use super::{
    state::Account,
    decoy::Decoys
};

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
    block: &BlockInfo,
    decoys: Option<&Decoys>
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
        owner.add_tx(store, &tx, None)?;
        owner.add_transfer(store, &transfer, None)?;
    }
    // Write to the sender's history if it's different from the receiver
    if sender != receiver {
        sender.add_tx(store, &tx, None)?;
        sender.add_transfer(store, &transfer, None)?;
    }

    // Always write to the recipient's history
    receiver.add_tx(store, &tx, decoys)?;

    receiver.add_transfer(store, &transfer, decoys)
}

pub fn store_mint(
    store: &mut dyn Storage,
    minter: &Account,
    recipient: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
    decoys: Option<&Decoys>
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
        recipient.add_tx(store, &tx, decoys)?;
    }
    
    minter.add_tx(store, &tx, None)
}

pub fn store_burn(
    store: &mut dyn Storage,
    owner: &Account,
    burner: &Account,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
    decoys: Option<&Decoys>
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
        owner.add_tx(store, &tx, decoys)?;
    }

    burner.add_tx(store, &tx, None)
}

#[inline]
pub fn store_deposit(
    store: &mut dyn Storage,
    recipient: &Account,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
    decoys: Option<&Decoys>
) -> StdResult<()> {
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        TxActionCanon::deposit(),
        Coin { denom, amount },
        None,
        block
    );

    recipient.add_tx(store, &tx, decoys)
}

#[inline]
pub fn store_redeem(
    store: &mut dyn Storage,
    redeemer: &Account,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
    decoys: Option<&Decoys>
) -> StdResult<()> {
    let tx = RichTxCanon::new(
        TX_COUNT.increment(store)?,
        TxActionCanon::redeem(),
        Coin { denom, amount },
        None,
        block
    );

    redeemer.add_tx(store, &tx, decoys)
}

impl Account {
    #[inline]
    pub fn add_tx(
        &self,
        storage: &mut dyn Storage,
        tx: &RichTxCanon,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        let mut txs = self.txs_storage();

        match decoys {
            Some(decoys) => {
                for (i, decoy) in decoys.shuffle_in(self).enumerate() {
                    if decoys.acc_index() == i {
                        txs.push(storage, tx)?;
                    } else {
                        let action = TxActionCanon::decoy(decoy.addr().clone());
                        let tx = RichTxCanon {
                            id: tx.id,
                            action,
                            coins: tx.coins.clone(),
                            memo: tx.memo.clone(),
                            block_time: tx.block_time,
                            block_height: tx.block_height
                        };

                        decoy.add_tx(storage, &tx, None)?;
                    }
                }
            },
            None => { txs.push(storage, tx)?; }
        }

        Ok(())
    }

    #[inline]
    pub fn add_transfer(
        &self,
        storage: &mut dyn Storage,
        tx: &Tx<CanonicalAddr>,
        decoys: Option<&Decoys>
    ) -> StdResult<()> {
        let mut transfers = self.transfers_storage();

        match decoys {
            Some(decoys) => {
                for (i, decoy) in decoys.shuffle_in(self).enumerate() {
                    if decoys.acc_index() == i {
                        transfers.push(storage, tx)?;
                    } else {
                        let tx = Tx {
                            id: tx.id,
                            from: tx.from.clone(),
                            sender: tx.sender.clone(),
                            receiver: decoy.addr().clone(),
                            coins: tx.coins.clone(),
                            memo: tx.memo.clone(),
                            block_time: tx.block_time,
                            // This serves as a decoy identifier
                            block_height: Some(0)
                        };

                        decoy.add_transfer(storage, &tx, None)?;
                    }
                }
            },
            None => { transfers.push(storage, tx)?; }
        }

        Ok(())
    }

    #[inline]
    pub fn txs(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32,
        filter_decoys: bool
    ) -> StdResult<(Vec<RichTx>, u64)> {
        let iter = self.txs_storage().iter(deps.storage)?;
        
        pages(
            iter,
            deps.api,
            page,
            page_size,
            if filter_decoys {
                Some(|x: &RichTxCanon| x.action.ty() != TxCode::Decoy)
            } else {
                None
            }
        )
    }

    #[inline]
    pub fn transfers(
        &self,
        deps: Deps,
        page: u32,
        page_size: u32,
        filter_decoys: bool
    ) -> StdResult<(Vec<Tx<Addr>>, u64)> {
        let iter = self.transfers_storage().iter(deps.storage)?;

        pages(
            iter,
            deps.api,
            page,
            page_size,
            if filter_decoys {
                Some(|x: &Tx<CanonicalAddr>| x.block_height != Some(0))
            } else {
                None
            }
        )
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
    page_size: u32,
    filter: Option<impl Fn(&T) -> bool>
) -> StdResult<(Vec<<T as Humanize>::Output>, u64)>  {
    let len = iter.len();
    let iter = iter
        .into_iter()
        .rev()
        .skip((page * page_size) as usize)
        .take(page_size as usize);

    let mut result = Vec::with_capacity(iter.len());

    if let Some(filter) = filter {
        for item in iter {
            let item = item?;

            if filter(&item) {
                result.push(item.humanize(api)?);
            }
        }
    } else {
        for item in iter {
            result.push(item?.humanize(api)?);
        }
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

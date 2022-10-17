use std::marker::PhantomData;

use serde::{Deserialize, Serialize};
use serde::de::DeserializeOwned;

use crate::{
    prelude::*,
    snip20::client::msg::{Tx, RichTx, TxAction}
};

use super::state::Config;


const NS_TXS: &[u8] = b"transactions";
const NS_TRANSFERS: &[u8] = b"transfers";
const NS_USER_TX_INDEX: &[u8] = b"u_tx_index";

type UserTxIndex = u32;

/// This type is the stored version of the legacy transfers
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
struct StoredLegacyTransfer {
    id: u64,
    from: CanonicalAddr,
    sender: CanonicalAddr,
    receiver: CanonicalAddr,
    coins: Coin,
    memo: Option<String>,
    block_time: u64,
    block_height: u64,
}

impl StoredLegacyTransfer {
    pub fn into_humanized(self, api: &dyn Api) -> StdResult<Tx> {
        let tx = Tx {
            id: self.id,
            from: api.addr_humanize(&self.from)?,
            sender: api.addr_humanize(&self.sender)?,
            receiver: api.addr_humanize(&self.receiver)?,
            coins: self.coins,
            memo: self.memo,
            block_time: Some(self.block_time),
            block_height: Some(self.block_height),
        };
        Ok(tx)
    }
}

#[derive(Clone, Copy, Debug)]
#[repr(u8)]
enum TxCode {
    Transfer = 0,
    Mint = 1,
    Burn = 2,
    Deposit = 3,
    Redeem = 4,
}

impl TxCode {
    fn to_u8(self) -> u8 {
        self as u8
    }

    fn from_u8(n: u8) -> StdResult<Self> {
        match n {
            0 => Ok(Self::Transfer),
            1 => Ok(Self::Mint),
            2 => Ok(Self::Burn),
            3 => Ok(Self::Deposit),
            4 => Ok(Self::Redeem),
            other => Err(StdError::generic_err(format!(
                "Unexpected Tx code in transaction history: {} Storage is corrupted.",
                other
            ))),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
struct StoredTxAction {
    tx_type: u8,
    address1: Option<CanonicalAddr>,
    address2: Option<CanonicalAddr>,
    address3: Option<CanonicalAddr>,
}

impl StoredTxAction {
    fn transfer(from: CanonicalAddr, sender: CanonicalAddr, recipient: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Transfer.to_u8(),
            address1: Some(from),
            address2: Some(sender),
            address3: Some(recipient),
        }
    }
    fn mint(minter: CanonicalAddr, recipient: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Mint.to_u8(),
            address1: Some(minter),
            address2: Some(recipient),
            address3: None,
        }
    }
    fn burn(owner: CanonicalAddr, burner: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Burn.to_u8(),
            address1: Some(burner),
            address2: Some(owner),
            address3: None,
        }
    }
    fn deposit() -> Self {
        Self {
            tx_type: TxCode::Deposit.to_u8(),
            address1: None,
            address2: None,
            address3: None,
        }
    }
    fn redeem() -> Self {
        Self {
            tx_type: TxCode::Redeem.to_u8(),
            address1: None,
            address2: None,
            address3: None,
        }
    }

    fn into_humanized(self, api: &dyn Api) -> StdResult<TxAction> {
        let transfer_addr_err = || {
            StdError::generic_err(
                "Missing address in stored Transfer transaction. Storage is corrupt",
            )
        };
        let mint_addr_err = || {
            StdError::generic_err("Missing address in stored Mint transaction. Storage is corrupt")
        };
        let burn_addr_err = || {
            StdError::generic_err("Missing address in stored Burn transaction. Storage is corrupt")
        };

        // In all of these, we ignore fields that we don't expect to find populated
        let action = match TxCode::from_u8(self.tx_type)? {
            TxCode::Transfer => {
                let from = self.address1.ok_or_else(transfer_addr_err)?;
                let sender = self.address2.ok_or_else(transfer_addr_err)?;
                let recipient = self.address3.ok_or_else(transfer_addr_err)?;
                let from = api.addr_humanize(&from)?;
                let sender = api.addr_humanize(&sender)?;
                let recipient = api.addr_humanize(&recipient)?;
                TxAction::Transfer {
                    from,
                    sender,
                    recipient,
                }
            }
            TxCode::Mint => {
                let minter = self.address1.ok_or_else(mint_addr_err)?;
                let recipient = self.address2.ok_or_else(mint_addr_err)?;
                let minter = api.addr_humanize(&minter)?;
                let recipient = api.addr_humanize(&recipient)?;
                TxAction::Mint { minter, recipient }
            }
            TxCode::Burn => {
                let burner = self.address1.ok_or_else(burn_addr_err)?;
                let owner = self.address2.ok_or_else(burn_addr_err)?;
                let burner = api.addr_humanize(&burner)?;
                let owner = api.addr_humanize(&owner)?;
                TxAction::Burn { burner, owner }
            }
            TxCode::Deposit => TxAction::Deposit {},
            TxCode::Redeem => TxAction::Redeem {},
        };

        Ok(action)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
struct StoredRichTx {
    id: u64,
    action: StoredTxAction,
    coins: Coin,
    memo: Option<String>,
    block_time: u64,
    block_height: u64,
}

impl StoredRichTx {
    fn new(
        id: u64,
        action: StoredTxAction,
        coins: Coin,
        memo: Option<String>,
        block: &BlockInfo,
    ) -> Self {
        Self {
            id,
            action,
            coins,
            memo,
            block_time: block.time.seconds(),
            block_height: block.height,
        }
    }

    fn into_humanized(self, api: &dyn Api) -> StdResult<RichTx> {
        Ok(RichTx {
            id: self.id,
            action: self.action.into_humanized(api)?,
            coins: self.coins,
            memo: self.memo,
            block_time: self.block_time,
            block_height: self.block_height,
        })
    }

    fn from_stored_legacy_transfer(transfer: StoredLegacyTransfer) -> Self {
        let action = StoredTxAction::transfer(transfer.from, transfer.sender, transfer.receiver);
        Self {
            id: transfer.id,
            action,
            coins: transfer.coins,
            memo: transfer.memo,
            block_time: transfer.block_time,
            block_height: transfer.block_height,
        }
    }
}

// Storage functions:

#[allow(clippy::too_many_arguments)] // We just need them
pub fn store_transfer(
    store: &mut dyn Storage,
    owner: &CanonicalAddr,
    sender: &CanonicalAddr,
    receiver: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    let id = Config::increment_tx_count(store)?;
    let coins = Coin { denom, amount };
    let transfer = StoredLegacyTransfer {
        id,
        from: owner.clone(),
        sender: sender.clone(),
        receiver: receiver.clone(),
        coins,
        memo,
        block_time: block.time.seconds(),
        block_height: block.height,
    };
    let tx = StoredRichTx::from_stored_legacy_transfer(transfer.clone());

    // Write to the owners history if it's different from the other two addresses
    if owner != sender && owner != receiver {
        append_tx(store, &tx, owner)?;
        append_transfer(store, &transfer, owner)?;
    }
    // Write to the sender's history if it's different from the receiver
    if sender != receiver {
        append_tx(store, &tx, sender)?;
        append_transfer(store, &transfer, sender)?;
    }
    // Always write to the recipient's history
    append_tx(store, &tx, receiver)?;
    append_transfer(store, &transfer, receiver)?;

    Ok(())
}

pub fn store_mint(
    store: &mut dyn Storage,
    minter: &CanonicalAddr,
    recipient: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    let id = Config::increment_tx_count(store)?;
    let coins = Coin { denom, amount };
    let action = StoredTxAction::mint(minter.clone(), recipient.clone());
    let tx = StoredRichTx::new(id, action, coins, memo, block);

    if minter != recipient {
        append_tx(store, &tx, recipient)?;
    }
    append_tx(store, &tx, minter)?;

    Ok(())
}

pub fn store_burn(
    store: &mut dyn Storage,
    owner: &CanonicalAddr,
    burner: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    memo: Option<String>,
    block: &BlockInfo,
) -> StdResult<()> {
    let id = Config::increment_tx_count(store)?;
    let coins = Coin { denom, amount };
    let action = StoredTxAction::burn(owner.clone(), burner.clone());
    let tx = StoredRichTx::new(id, action, coins, memo, block);

    if burner != owner {
        append_tx(store, &tx, owner)?;
    }
    append_tx(store, &tx, burner)?;

    Ok(())
}

pub fn store_deposit(
    store: &mut dyn Storage,
    recipient: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
) -> StdResult<()> {
    let id = Config::increment_tx_count(store)?;
    let coins = Coin { denom, amount };
    let action = StoredTxAction::deposit();
    let tx = StoredRichTx::new(id, action, coins, None, block);

    append_tx(store, &tx, recipient)?;

    Ok(())
}

pub fn store_redeem(
    store: &mut dyn Storage,
    redeemer: &CanonicalAddr,
    amount: Uint128,
    denom: String,
    block: &BlockInfo,
) -> StdResult<()> {
    let id = Config::increment_tx_count(store)?;
    let coins = Coin { denom, amount };
    let action = StoredTxAction::redeem();
    let tx = StoredRichTx::new(id, action, coins, None, block);

    append_tx(store, &tx, redeemer)?;

    Ok(())
}

pub fn get_txs(
    deps: Deps,
    for_address: &CanonicalAddr,
    page: u32,
    page_size: u32,
) -> StdResult<(Vec<RichTx>, u64)> {
    let iter = TxIterator::<StoredRichTx>::new(
        deps.storage,
        create_tx_ns(for_address)
    )?;

    let len = iter.len();

    // Take `page_size` txs starting from the latest tx, potentially skipping `page * page_size`
    // txs from the start.
    let tx_iter = iter
        .into_iter()
        .rev()
        .skip((page * page_size) as _)
        .take(page_size as _);

    // The `and_then` here flattens the `StdResult<StdResult<RichTx>>` to an `StdResult<RichTx>`
    let txs: StdResult<Vec<RichTx>> = tx_iter
        .map(|tx| tx.map(|tx| tx.into_humanized(deps.api)).and_then(|x| x))
        .collect();

    txs.map(|txs| (txs, len as u64))
}

pub fn get_transfers(
    deps: Deps,
    for_address: &CanonicalAddr,
    page: u32,
    page_size: u32,
) -> StdResult<(Vec<Tx>, u64)> {
    let iter = TxIterator::<StoredLegacyTransfer>::new(
        deps.storage,
        create_transfer_ns(for_address)
    )?;

    let len = iter.len();

    // Take `page_size` txs starting from the latest tx, potentially skipping `page * page_size`
    // txs from the start.
    let transfer_iter = iter
        .into_iter()
        .rev()
        .skip((page * page_size) as _)
        .take(page_size as _);

    // The `and_then` here flattens the `StdResult<StdResult<RichTx>>` to an `StdResult<RichTx>`
    let transfers: StdResult<Vec<Tx>> = transfer_iter
        .map(|tx| tx.map(|tx| tx.into_humanized(deps.api)).and_then(|x| x))
        .collect();

    transfers.map(|txs| (txs, len as u64))
}

fn append_tx(
    storage: &mut dyn Storage,
    tx: &StoredRichTx,
    for_address: &CanonicalAddr,
) -> StdResult<()> {
    let ns = create_tx_ns(for_address);

    let index = load_user_tx_index(storage, &ns)?;
    ns_save(storage, &ns, &index.to_be_bytes(), &tx)?;

    save_user_tx_index(storage, &ns, index + 1)
}

fn append_transfer(
    storage: &mut dyn Storage,
    tx: &StoredLegacyTransfer,
    for_address: &CanonicalAddr,
) -> StdResult<()> {
    let ns = create_transfer_ns(for_address);

    let index = load_user_tx_index(storage, &ns)?;
    ns_save(storage, &ns, &index.to_be_bytes(), &tx)?;

    save_user_tx_index(storage, &ns, index + 1)
}

#[inline]
fn load_user_tx_index(storage: &dyn Storage, ns: &[u8]) -> StdResult<UserTxIndex> {
    let result = ns_load(storage, ns, NS_USER_TX_INDEX)?;

    Ok(result.unwrap_or(0))
}

#[inline]
fn save_user_tx_index(storage: &mut dyn Storage, ns: &[u8], index: UserTxIndex) -> StdResult<()> {
    ns_save(storage, ns, NS_USER_TX_INDEX, &index)
}

#[inline]
fn create_tx_ns(address: &CanonicalAddr) -> Vec<u8> {
    [NS_TXS, address.as_slice()].concat()
}

#[inline]
fn create_transfer_ns(address: &CanonicalAddr) -> Vec<u8> {
    [NS_TRANSFERS, address.as_slice()].concat()
}

struct TxIterator<'a, T: DeserializeOwned> {
    storage: &'a dyn Storage,
    ns: Vec<u8>,
    current: UserTxIndex,
    end: UserTxIndex,
    result: PhantomData<T>
}

impl<'a, T: DeserializeOwned> TxIterator<'a, T> {
    fn new(storage: &'a dyn Storage, ns: Vec<u8>) -> StdResult<Self> {
        let end = load_user_tx_index(storage, &ns)?;

        Ok(Self {
            storage,
            ns,
            current: 0,
            end,
            result: PhantomData
        })
    }

    fn len(&self) -> UserTxIndex {
        self.end
    }
}

impl<'a, T: DeserializeOwned> Iterator for TxIterator<'a, T> {
    type Item = StdResult<T>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        let result: Self::Item = ns_load(
            self.storage,
            &self.ns,
            &self.current.to_be_bytes()
        )
        .map(|x| x.unwrap());

        self.current += 1;

        Some(result)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let len = (self.end - self.current) as usize;
        (len, Some(self.end as usize))
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        self.current = self.current.saturating_add(n as u32);
        self.next()
    }
}

impl<'a, T: DeserializeOwned> DoubleEndedIterator for TxIterator<'a, T> {
    fn next_back(&mut self) -> Option<Self::Item> {
        if self.current >= self.end {
            return None;
        }

        self.end -= 1;

        let result: Self::Item = ns_load(
            self.storage,
            &self.ns,
            &self.end.to_be_bytes()
        )
        .map(|x| x.unwrap());

        Some(result)
    }

    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
        self.end = self.end.saturating_sub(n as u32);
        self.next_back()
    }
}

impl<'a, T: DeserializeOwned> ExactSizeIterator for TxIterator<'a, T> { }
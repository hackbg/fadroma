use std::mem;

use crate::{
    self as fadroma,
    prelude::*
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // Native coin interactions
    Redeem {
        amount: Uint128,
        denom: Option<String>,
        padding: Option<String>,
    },
    Deposit {
        padding: Option<String>,
    },

    // Base ERC-20 stuff
    Transfer {
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        padding: Option<String>,
    },
    Send {
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        msg: Option<Binary>,
        memo: Option<String>,
        padding: Option<String>,
    },
    BatchTransfer {
        actions: Vec<TransferAction>,
        padding: Option<String>,
    },
    BatchSend {
        actions: Vec<SendAction>,
        padding: Option<String>,
    },
    Burn {
        amount: Uint128,
        memo: Option<String>,
        padding: Option<String>,
    },
    RegisterReceive {
        code_hash: String,
        padding: Option<String>,
    },
    CreateViewingKey {
        entropy: String,
        padding: Option<String>,
    },
    SetViewingKey {
        key: String,
        padding: Option<String>,
    },

    // Allowance
    IncreaseAllowance {
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
        padding: Option<String>,
    },
    DecreaseAllowance {
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
        padding: Option<String>,
    },
    TransferFrom {
        owner: String,
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        padding: Option<String>,
    },
    SendFrom {
        owner: String,
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        msg: Option<Binary>,
        memo: Option<String>,
        padding: Option<String>,
    },
    BatchTransferFrom {
        actions: Vec<TransferFromAction>,
        padding: Option<String>,
    },
    BatchSendFrom {
        actions: Vec<SendFromAction>,
        padding: Option<String>,
    },
    BurnFrom {
        owner: String,
        amount: Uint128,
        memo: Option<String>,
        padding: Option<String>,
    },
    BatchBurnFrom {
        actions: Vec<BurnFromAction>,
        padding: Option<String>,
    },

    // Mint
    Mint {
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        padding: Option<String>,
    },
    BatchMint {
        actions: Vec<MintAction>,
        padding: Option<String>,
    },
    AddMinters {
        minters: Vec<String>,
        padding: Option<String>,
    },
    RemoveMinters {
        minters: Vec<String>,
        padding: Option<String>,
    },
    SetMinters {
        minters: Vec<String>,
        padding: Option<String>,
    },

    // Admin
    ChangeAdmin {
        address: String,
        padding: Option<String>,
    },
    SetContractStatus {
        level: ContractStatusLevel,
        padding: Option<String>,
    },

    // Permit
    RevokePermit {
        permit_name: String,
        padding: Option<String>
    }
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteAnswer {
    // Native
    Deposit {
        status: ResponseStatus,
    },
    Redeem {
        status: ResponseStatus,
    },

    // Base
    Transfer {
        status: ResponseStatus,
    },
    Send {
        status: ResponseStatus,
    },
    BatchTransfer {
        status: ResponseStatus,
    },
    BatchSend {
        status: ResponseStatus,
    },
    Burn {
        status: ResponseStatus,
    },
    RegisterReceive {
        status: ResponseStatus,
    },
    #[cfg(feature = "snip20-impl")]
    CreateViewingKey {
        key: ViewingKey,
    },
    SetViewingKey {
        status: ResponseStatus,
    },

    // Allowance
    IncreaseAllowance {
        spender: Addr,
        owner: Addr,
        allowance: Uint128,
    },
    DecreaseAllowance {
        spender: Addr,
        owner: Addr,
        allowance: Uint128,
    },
    TransferFrom {
        status: ResponseStatus,
    },
    SendFrom {
        status: ResponseStatus,
    },
    BatchTransferFrom {
        status: ResponseStatus,
    },
    BatchSendFrom {
        status: ResponseStatus,
    },
    BurnFrom {
        status: ResponseStatus,
    },
    BatchBurnFrom {
        status: ResponseStatus,
    },

    // Mint
    Mint {
        status: ResponseStatus,
    },
    BatchMint {
        status: ResponseStatus,
    },
    AddMinters {
        status: ResponseStatus,
    },
    RemoveMinters {
        status: ResponseStatus,
    },
    SetMinters {
        status: ResponseStatus,
    },

    // Other
    ChangeAdmin {
        status: ResponseStatus,
    },
    SetContractStatus {
        status: ResponseStatus,
    },

    // Permit
    RevokePemit {
        status: ResponseStatus
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    TokenInfo {},
    ContractStatus {},
    ExchangeRate {},
    Allowance {
        owner: String,
        spender: String,
        key: String,
    },
    Balance {
        address: String,
        key: String,
    },
    TransferHistory {
        address: String,
        key: String,
        page: Option<u32>,
        page_size: u32,
    },
    TransactionHistory {
        address: String,
        key: String,
        page: Option<u32>,
        page_size: u32,
    },
    Minters {},
    #[cfg(feature = "snip20-impl")]
    WithPermit {
        permit: Permit<QueryPermission>,
        query: QueryWithPermit
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryWithPermit {
    Allowance {
        owner: Addr,
        spender: Addr,
    },
    Balance {},
    TransferHistory {
        page: Option<u32>,
        page_size: u32,
    },
    TransactionHistory {
        page: Option<u32>,
        page_size: u32
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryPermission {
    /// Allowance for SNIP-20 - Permission to query allowance of the owner & spender
    Allowance,
    /// Balance for SNIP-20 - Permission to query balance
    Balance,
    /// History for SNIP-20 - Permission to query transfer_history & transaction_hisotry
    History,
    /// Owner permission indicates that the bearer of this permit should be granted all
    /// the access of the creator/signer of the permit.  SNIP-721 uses this to grant
    /// viewing access to all data that the permit creator owns and is whitelisted for.
    /// For SNIP-721 use, a permit with Owner permission should NEVER be given to
    /// anyone else.  If someone wants to share private data, they should whitelist
    /// the address they want to share with via a SetWhitelistedApproval tx, and that
    /// address will view the data by creating their own permit with Owner permission
    Owner
}

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum QueryAnswer {
    TokenInfo(TokenInfo),
    ContractStatus {
        status: ContractStatusLevel,
    },
    ExchangeRate {
        rate: Uint128,
        denom: String,
    },
    Allowance {
        spender: Addr,
        owner: Addr,
        allowance: Uint128,
        expiration: Option<u64>,
    },
    Balance {
        amount: Uint128,
    },
    TransferHistory {
        txs: Vec<Tx<Addr>>,
        total: Option<u64>,
    },
    TransactionHistory {
        txs: Vec<RichTx>,
        total: Option<u64>,
    },
    ViewingKeyError {
        msg: String,
    },
    Minters {
        minters: Vec<Addr>
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TokenInfo {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_supply: Option<Uint128>
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct CreateViewingKeyResponse {
    pub key: String
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    Success,
    Failure
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ContractStatusLevel {
    NormalRun,
    StopAllButRedeems,
    StopAll
}

// Transfer history
#[derive(Serialize, Deserialize, Canonize, JsonSchema, Clone, Debug)]
pub struct Tx<T> {
    pub id: u64,
    pub from: T,
    pub sender: T,
    pub receiver: T,
    pub coins: Coin,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
    // The block time and block height are optional so that the JSON schema
    // reflects that some SNIP-20 contracts may not include this info.
    pub block_time: Option<u64>,
    pub block_height: Option<u64>
}

#[derive(Serialize, Deserialize, Canonize, JsonSchema, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct RichTx {
    pub id: u64,
    pub action: TxAction,
    pub coins: Coin,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
    pub block_time: u64,
    pub block_height: u64
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TxAction {
    Transfer {
        from: Addr,
        sender: Addr,
        recipient: Addr
    },
    Mint {
        minter: Addr,
        recipient: Addr
    },
    Burn {
        burner: Addr,
        owner: Addr
    },
    Deposit {},
    Redeem {}
}

#[derive(Clone, Copy, Debug)]
#[repr(u8)]
pub enum TxCode {
    Transfer = 0,
    Mint = 1,
    Burn = 2,
    Deposit = 3,
    Redeem = 4
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TxActionCanon {
    tx_type: u8,
    address1: Option<CanonicalAddr>,
    address2: Option<CanonicalAddr>,
    address3: Option<CanonicalAddr>
}

// Batch

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TransferAction {
    pub recipient: String,
    pub amount: Uint128,
    pub memo: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendAction {
    pub recipient: String,
    pub recipient_code_hash: Option<String>,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    pub memo: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TransferFromAction {
    pub owner: String,
    pub recipient: String,
    pub amount: Uint128,
    pub memo: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendFromAction {
    pub owner: String,
    pub recipient_code_hash: Option<String>,
    pub recipient: String,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    pub memo: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct MintAction {
    pub recipient: String,
    pub amount: Uint128,
    pub memo: Option<String>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct BurnFromAction {
    pub owner: String,
    pub amount: Uint128,
    pub memo: Option<String>
}

impl TxActionCanon {
    #[inline]
    pub fn transfer(
        from: CanonicalAddr,
        sender: CanonicalAddr,
        recipient: CanonicalAddr
    ) -> Self {
        Self {
            tx_type: TxCode::Transfer as u8,
            address1: Some(from),
            address2: Some(sender),
            address3: Some(recipient)
        }
    }

    #[inline]
    pub fn mint(minter: CanonicalAddr, recipient: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Mint as u8,
            address1: Some(minter),
            address2: Some(recipient),
            address3: None
        }
    }

    #[inline]
    pub fn burn(owner: CanonicalAddr, burner: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Burn as u8,
            address1: Some(burner),
            address2: Some(owner),
            address3: None
        }
    }

    #[inline]
    pub fn deposit() -> Self {
        Self {
            tx_type: TxCode::Deposit as u8,
            address1: None,
            address2: None,
            address3: None
        }
    }

    #[inline]
    pub fn redeem() -> Self {
        Self {
            tx_type: TxCode::Redeem as u8,
            address1: None,
            address2: None,
            address3: None
        }
    }
}

impl Canonize for TxAction {
    type Output = TxActionCanon;

    fn canonize(self, api: &dyn Api) -> StdResult<Self::Output> {
        let action = match self {
            Self::Transfer { from, sender, recipient } =>
                TxActionCanon::transfer(
                    from.canonize(api)?,
                    sender.canonize(api)?,
                    recipient.canonize(api)?
                ),
            Self::Mint { minter, recipient } =>
                TxActionCanon::mint(
                    minter.canonize(api)?,
                    recipient.canonize(api)?
                ),
            Self::Burn { burner, owner } =>
                TxActionCanon::burn(
                    owner.canonize(api)?,
                    burner.canonize(api)?
                ),
            Self::Deposit { } => TxActionCanon::deposit(),
            Self::Redeem { } => TxActionCanon::redeem()
        };

        Ok(action)
    }
}

impl Humanize for TxActionCanon {
    type Output = TxAction;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        // Safety: TxActionCanon can only be constructed using the action
        // constructors that use the reverse cast which is always safe.
        let code: TxCode = unsafe { mem::transmute(self.tx_type) };

        let result = match code {
            TxCode::Transfer => {
                let from = self.address1.unwrap();
                let sender = self.address2.unwrap();
                let recipient = self.address3.unwrap();

                TxAction::Transfer {
                    from: from.humanize(api)?,
                    sender: sender.humanize(api)?,
                    recipient: recipient.humanize(api)?
                }
            }
            TxCode::Mint => {
                let minter = self.address1.unwrap();
                let recipient = self.address2.unwrap();

                TxAction::Mint {
                    minter: minter.humanize(api)?,
                    recipient: recipient.humanize(api)?
                }
            }
            TxCode::Burn => {
                let burner = self.address1.unwrap();
                let owner = self.address2.unwrap();

                TxAction::Burn {
                    burner: burner.humanize(api)?,
                    owner: owner.humanize(api)?
                }
            }
            TxCode::Deposit => TxAction::Deposit {},
            TxCode::Redeem => TxAction::Redeem {},
        };

        Ok(result)
    }
}

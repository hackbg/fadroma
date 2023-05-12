use std::mem;

use crate::{
    self as fadroma,
    schemars::JsonSchema,
    dsl::*,
    scrt::{
        vk::{auth::VkAuth, ViewingKey},
        permit::Permit,
        ResponseExt
    },
    admin::Admin,
    cosmwasm_std::{
        self, StdResult, Api, Response, Uint128,
        Binary, Addr, CanonicalAddr, Coin, to_binary
    },
    bin_serde::{FadromaSerialize, FadromaDeserialize},
    core::{Humanize, Canonize, Callback}
};
use serde::{Deserialize, Serialize};

/// Interface trait that defines all methods of the SNIP-20 standard.
/// See [`fadroma::scrt::snip20::contract`] for the default implementation.
#[interface]
pub trait Snip20: VkAuth + Admin {
    type Error: std::fmt::Display;

    #[init]
    fn new(
        name: String,
        admin: Option<String>,
        symbol: String,
        decimals: u8,
        initial_balances: Option<Vec<InitialBalance>>,
        prng_seed: Binary,
        config: Option<TokenConfig>,
        supported_denoms: Option<Vec<String>>,
        callback: Option<Callback<String>>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn deposit(
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn redeem(
        amount: Uint128,
        denom: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn transfer(
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn send(
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn burn(
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn register_receive(
        code_hash: String,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn increase_allowance(
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn decrease_allowance(
        spender: String,
        amount: Uint128,
        expiration: Option<u64>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn transfer_from(
        owner: String,
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn send_from(
        owner: String,
        recipient: String,
        recipient_code_hash: Option<String>,
        amount: Uint128,
        memo: Option<String>,
        msg: Option<Binary>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn burn_from(
        owner: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn mint(
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn add_minters(
        minters: Vec<String>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn remove_minters(
        minters: Vec<String>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn set_minters(
        minters: Vec<String>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn add_supported_denoms(
        denoms: Vec<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn remove_supported_denoms(
        denoms: Vec<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_transfer(
        actions: Vec<TransferAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_send(
        actions: Vec<SendAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_transfer_from(
        actions: Vec<TransferFromAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_send_from(
        actions: Vec<SendFromAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_burn_from(
        actions: Vec<BurnFromAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn batch_mint(
        actions: Vec<MintAction>,
        entropy: Option<Binary>,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[execute]
    fn revoke_permit(
        permit_name: String,
        padding: Option<String>
    ) -> Result<Response, <Self as Snip20>::Error>;

    #[query]
    fn exchange_rate() -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn token_info() -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn token_config() -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn minters() -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn allowance(
        owner: String,
        spender: String,
        key: String
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn balance(
        address: String,
        key: String
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn transfer_history(
        address: String,
        key: String,
        page: Option<u32>,
        page_size: u32,
        should_filter_decoys: bool
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn transaction_history(
        address: String,
        key: String,
        page: Option<u32>,
        page_size: u32,
        should_filter_decoys: bool
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn allowances_given(
        owner: String,
        key: String,
        page: Option<u32>,
        page_size: u32
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn allowances_received(
        spender: String,
        key: String,
        page: Option<u32>,
        page_size: u32
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;

    #[query]
    fn with_permit(
        permit: Permit<QueryPermission>,
        query: QueryWithPermit
    ) -> Result<QueryAnswer, <Self as Snip20>::Error>;
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
pub struct InitialBalance {
    pub address: String,
    pub amount: Uint128
}

/// This type represents optional configuration values which can be overridden.
/// All values are optional and have defaults which are more private by default,
/// but can be overridden if necessary.
#[derive(Serialize, Deserialize, JsonSchema, Clone, Default, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TokenConfig {
    /// Indicates whether the total supply is public or should be kept secret.
    /// default: False
    pub public_total_supply: bool,
    /// Indicates whether deposit functionality should be enabled
    /// default: False
    pub enable_deposit: bool,
    /// Indicates whether redeem functionality should be enabled
    /// default: False
    pub enable_redeem: bool,
    /// Indicates whether mint functionality should be enabled
    /// default: False
    pub enable_mint: bool,
    /// Indicates whether burn functionality should be enabled
    /// default: False
    pub enable_burn: bool,
    /// Indicates whether it's possible to change the allowed
    /// native denoms that can be exchanged for this token.
    /// default: False
    pub enable_modify_denoms: bool
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
    AddSupportedDenoms {
        status: ResponseStatus,
    },
    RemoveSupportedDenoms {
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
    SetStatus {
        status: ResponseStatus,
    },

    // Permit
    RevokePemit {
        status: ResponseStatus
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryWithPermit {
    Allowance {
        owner: String,
        spender: String
    },
    Balance {},
    TransferHistory {
        page: Option<u32>,
        page_size: u32,
        should_filter_decoys: bool
    },
    TransactionHistory {
        page: Option<u32>,
        page_size: u32,
        should_filter_decoys: bool
    },
    AllowancesGiven { 
        owner: String, 
        page: Option<u32>, 
        page_size: u32 
    },
    AllowancesReceived { 
        spender: String, 
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
    TokenConfig {
        public_total_supply: bool,
        deposit_enabled: bool,
        redeem_enabled: bool,
        mint_enabled: bool,
        burn_enabled: bool,
        supported_denoms: Vec<String>
    },
    ExchangeRate {
        rate: Uint128,
        denom: String
    },
    Allowance {
        spender: Addr,
        owner: Addr,
        allowance: Uint128,
        expiration: Option<u64>
    },
    AllowancesGiven {
        owner: Addr,
        allowances: Vec<GivenAllowance>,
        count: u64
    },
    AllowancesReceived {
        spender: Addr,
        allowances: Vec<ReceivedAllowance>,
        count: u64
    },
    Balance {
        amount: Uint128
    },
    TransferHistory {
        txs: Vec<Tx<Addr>>,
        total: Option<u64>
    },
    TransactionHistory {
        txs: Vec<RichTx>,
        total: Option<u64>
    },
    ViewingKeyError {
        msg: String
    },
    Minters {
        minters: Vec<Addr>
    }
}

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TokenInfo {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_supply: Option<Uint128>
}

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Clone, Debug)]
pub struct GivenAllowance {
    pub spender: Addr,
    pub allowance: Uint128,
    pub expiration: Option<u64>
}

#[derive(Serialize, Deserialize, JsonSchema, PartialEq, Clone, Debug)]
pub struct ReceivedAllowance {
    pub owner: Addr,
    pub allowance: Uint128,
    pub expiration: Option<u64>
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

// Transfer history
#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Canonize, JsonSchema, PartialEq, Clone, Debug)]
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
    Redeem {},
    Decoy {
        address: Addr
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u8)]
pub enum TxCode {
    Transfer = 0,
    Mint = 1,
    Burn = 2,
    Deposit = 3,
    Redeem = 4,
    Decoy = 255
}

#[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Clone, Debug)]
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
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendAction {
    pub recipient: String,
    pub recipient_code_hash: Option<String>,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct TransferFromAction {
    pub owner: String,
    pub recipient: String,
    pub amount: Uint128,
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SendFromAction {
    pub owner: String,
    pub recipient_code_hash: Option<String>,
    pub recipient: String,
    pub amount: Uint128,
    pub msg: Option<Binary>,
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct MintAction {
    pub recipient: String,
    pub amount: Uint128,
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct BurnFromAction {
    pub owner: String,
    pub amount: Uint128,
    pub memo: Option<String>,
    pub decoys: Option<Vec<String>>
}

impl TxActionCanon {
    #[inline]
    pub fn ty(&self) -> TxCode {
        // Safety: TxActionCanon can only be constructed using the action
        // constructors that use the reverse cast which is always safe.
        unsafe { mem::transmute(self.tx_type) }
    }

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

    #[inline]
    pub fn decoy(recipient: CanonicalAddr) -> Self {
        Self {
            tx_type: TxCode::Decoy as u8,
            address1: Some(recipient),
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
            Self::Redeem { } => TxActionCanon::redeem(),
            Self::Decoy { address } =>
                TxActionCanon::decoy(address.canonize(api)?)
        };

        Ok(action)
    }
}

impl Humanize for TxActionCanon {
    type Output = TxAction;

    fn humanize(self, api: &dyn Api) -> StdResult<Self::Output> {
        let result = match self.ty() {
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
            TxCode::Decoy => {
                let address = self.address1.unwrap();

                TxAction::Decoy {
                    address: address.humanize(api)?
                }
            }
        };

        Ok(result)
    }
}

impl TokenConfig {
    #[inline]
    pub fn public_total_supply(mut self) -> Self {
        self.public_total_supply = true;

        self
    }

    #[inline]
    pub fn enable_deposit(mut self) -> Self {
        self.enable_deposit = true;

        self
    }

    #[inline]
    pub fn enable_redeem(mut self) -> Self {
        self.enable_redeem = true;

        self
    }

    #[inline]
    pub fn enable_mint(mut self) -> Self {
        self.enable_mint = true;

        self
    }

    #[inline]
    pub fn enable_burn(mut self) -> Self {
        self.enable_burn = true;

        self
    }

    #[inline]
    pub fn enable_modify_denoms(mut self) -> Self {
        self.enable_modify_denoms = true;

        self
    }
}

impl ExecuteAnswer {
    #[inline]
    pub fn with_resp(&self, response: Response) -> StdResult<Response> {
        Ok(response.set_data(to_binary(self)?).pad())
    }
}

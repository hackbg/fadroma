use fadroma::{
    scrt::{
        Addr, CanonicalAddr, StdError, StdResult, Api,
        Uint128, Deps, DepsMut, BlockInfo, Storage
    },
    scrt_storage::{save, load, ns_save, ns_load},
    scrt_addr::{Canonize, Humanize},
    scrt_vk::ViewingKey
};
use fadroma::schemars;
use fadroma::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::msg::ContractStatusLevel;

pub const PREFIX_TXS: &[u8] = b"YteGsgSZyO";
const KEY_ADMIN: &[u8] = b"9Fk1xtMbGg";

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
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
    pub burn_is_enabled: bool,
}

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, Default, JsonSchema)]
pub struct Allowance {
    pub amount: Uint128,
    pub expiration: Option<u64>,
}

impl Allowance {
    pub fn is_expired_at(&self, block: &BlockInfo) -> bool {
        match self.expiration {
            Some(time) => block.time >= time,
            None => false, // allowance has no expiration
        }
    }
}

pub fn get_admin(deps: Deps) -> StdResult<Addr> {
    let result: Option<CanonicalAddr> = load(deps.storage, KEY_ADMIN)?;

    match result {
        Some(admin) => deps.api.addr_humanize(&admin),
        None => Err(StdError::generic_err("No admin is set in storage."))
    }
}

pub fn set_admin(deps: DepsMut, admin: &Addr) -> StdResult<()> {
    let admin = deps.api.addr_canonicalize(admin)?;

    save(deps.storage, KEY_ADMIN)
}

pub struct Config;

impl Config {
    const PREFIX_CONFIG: &'static [u8] = b"YywNU6aiTV";
    const KEY_CONSTANTS: &'static [u8] = b"N3QP0mNoPG";
    const KEY_TOTAL_SUPPLY: &'static [u8] = b"bx98UUOWYa";
    const KEY_CONTRACT_STATUS: &'static [u8] = b"EhYS9rzai1";
    const KEY_MINTERS: &'static [u8] = b"wpitCjS7wB";
    const KEY_TX_COUNT: &'static [u8] = b"n8BHFWp7eT";

    pub fn set_constants(storage: &mut dyn Storage, constants: &Constants) -> StdResult<()> {
        save(storage, Self::KEY_CONSTANTS, constants)
    }

    pub fn get_constants(storage: &dyn Storage) -> StdResult<Constants> {
        load(storage, Self::KEY_CONSTANTS)?.ok_or_else(||
            StdError::generic_err("No constants stored in configuration")
        )
    }

    pub fn get_total_supply(storage: &dyn Storage) -> StdResult<u128> {
        let result: Uint128 = load(storage, Self::KEY_TOTAL_SUPPLY)?.unwrap_or_default();

        Ok(result.u128())
    }

    pub fn increase_total_supply(storage: &mut dyn Storage, amount: u128) -> StdResult<()> {
        let mut total_supply = Self::get_total_supply(storage)?;

        if let Some(new_total) = total_supply.checked_add(amount) {
            Self::set_total_supply(storage, new_total)
        } else {
            Err(StdError::generic_err(
                "This operation would overflow the currency's total supply.",
            ));
        }
    }

    pub fn decrease_total_supply(storage: &mut dyn Storage, amount: u128) -> StdResult<()> {
        let mut total_supply = Self::get_total_supply(storage)?;

        if let Some(new_total) = total_supply.checked_sub(amount) {
            Self::set_total_supply(storage, new_total)
        } else {
            Err(StdError::generic_err(
                "This operation would underflow the currency's total supply.",
            ));
        }
    }

    #[inline]
    pub fn set_total_supply(storage: &mut dyn Storage, supply: u128) -> StdResult<()> {
        save(storage, Self::KEY_TOTAL_SUPPLY, &Uint128::new(supply))
    }

    pub fn get_contract_status(storage: &dyn Storage) -> StdResult<ContractStatusLevel> {
        load(storage, Self::KEY_CONTRACT_STATUS)?.ok_or_else(||
            StdError::generic_err("No contract status stored in configuration")
        )
    }

    pub fn set_contract_status(storage: &mut dyn Storage, status: ContractStatusLevel) -> StdResult<()> {
        save(storage, Self::KEY_CONTRACT_STATUS, status)
    }

    pub fn get_minters(deps: Deps) -> StdResult<Vec<Addr>> {
        let minters: Vec<CanonicalAddr> = 
            load(deps.storage, Self::KEY_MINTERS)?.unwrap_or(vec![]);

        minters.humanize(deps.api)
    }

    pub fn set_minters(deps: DepsMut, minters: Vec<Addr>) -> StdResult<()> {
        let minters = minters.canonize(deps.api)?;

        save(deps.storage, Self::KEY_MINTERS, &minters)
    }

    pub fn add_minters(deps: DepsMut, new_minters: Vec<Addr>) -> StdResult<()> {
        let minters: Vec<CanonicalAddr> = 
            load(deps.storage, Self::KEY_MINTERS)?.unwrap_or(vec![]);

        let new_minters = new_minters.canonize(deps.api);
        minters.extend(new_minters);

        save(deps.storage, Self::KEY_MINTERS, &minters)
    }

    pub fn remove_minters(deps: DepsMut, to_remove: Vec<Addr>) -> StdResult<()> {
        let minters: Vec<CanonicalAddr> = 
            load(deps.storage, Self::KEY_MINTERS)?.unwrap_or(vec![]);

        let to_remove = to_remove.canonize(deps.api);

        for minter in to_remove {
            minters.retain(|x| x != &minter);
        }

        save(deps.storage, Self::KEY_MINTERS, &minters)
    }

    pub fn load_tx_count(storage: &dyn Storage) -> StdResult<u64> {
        load(storage, Self::KEY_TX_COUNT)?.unwrap_or(0)
    }

    pub fn set_tx_count(storage: &mut dyn Storage, count: u64) -> StdResult<()> {
        save(storage, Self::KEY_TX_COUNT, count)
    }
}

pub struct Account {
    addr: CanonicalAddr
}

impl Account {
    const NS_BALANCES: &'static [u8] = b"DyCKbmlEL8";
    const NS_VIEWING_KEY: &'static [u8] = b"MLRCoHCV8x";
    const NS_RECEIVERS: &'static [u8] = b"V1SJqXtGju";
    const PREFIX_ALLOWANCES: &'static [u8] = b"eXDXajOxRG";

    pub fn of(api: &dyn Api, addr: &Addr) -> StdResult<Self> {
        Ok(Self {
            addr: addr.canonize(api)?
        })
    }

    pub fn addr(&self) -> &CanonicalAddr {
        &self.addr
    }
    
    pub fn get_balance(&self, storage: &dyn Storage) -> StdResult<u128> {
        let result: Option<Uint128> = ns_load(storage, Self::NS_BALANCES, self.addr.as_slice())?;

        match result {
            Some(amount) => amount.u128(),
            None => 0
        }
    }

    pub fn add_balance(&self, storage: &mut dyn Storage, amount: u128) -> StdResult<()> {
        let account_balance = self.get_balance(storage)?;

        if let Some(new_balance) = account_balance.checked_add(amount) {
            self.set_balance(new_balance)
        } else {
            Err(StdError::generic_err(
                "This deposit would overflow your balance",
            ));
        }
    }

    pub fn subtract_balance(&self, storage: &mut dyn Storage, amount: u128) -> StdResult<()> {
        let account_balance = self.get_balance(storage)?;

        if let Some(new_balance) = account_balance.checked_sub(amount) {
            self.set_balance(new_balance)
        } else {
            Err(StdError::generic_err(format!(
                "insufficient funds: balance={}, required={}",
                account_balance, amount
            )));
        }
    }

    pub fn update_allowance<F>(
        &self,
        storage: &mut dyn Storage,
        spender: &CanonicalAddr,
        func: F
    ) -> StdResult<Allowance>
        where F: FnOnce(&mut Allowance) -> StdResult<()>
    {
        let ns = self.create_allowance_ns();
        
        let mut allowance =
            ns_load(storage, ns, spender.as_slice())?
            .unwrap_or_default();

        func(&mut allowance)?;
        ns_save(storage, ns, spender.as_slice(), &allowance)?;

        Ok(allowance)
    }

    pub fn get_allowance(&self, deps: Deps, spender: &Addr) -> StdResult<Allowance> {
        let spender = spender.canonize(deps.api)?;
        let ns = self.create_allowance_ns();

        ns_load(deps.storage, ns, spender.as_slice())?.unwrap_or_default()
    }

    pub fn get_viewing_key(&self, storage: &dyn Storage) -> StdResult<Option<Vec<u8>>> {
        ns_load(storage, Self::NS_VIEWING_KEY, self.addr.as_slice())
    }

    pub fn set_viewing_key(&self, storage: &mut dyn Storage, key: &ViewingKey) -> StdResult<()> {
        ns_save(storage, Self::NS_VIEWING_KEY, self.addr.as_slice(), key.to_hashed())
    }

    pub fn get_receiver_hash(&self, storage: &dyn Storage) -> StdResult<Option<String>> {
        ns_load(storage, Self::KEY_RECEIVERS, self.addr.as_slice())?
            .map(|data| {
                String::from_utf8(data).map_err(|_err|
                    StdError::invalid_utf8("Stored code hash was not a valid String")
                )
            })
    }

    pub fn set_receiver_hash(&self, storage: &mut dyn Storage, code_hash: &String) -> StdResult<()> {
        let bytes = code_hash.as_bytes();

        ns_save(storage, Self::KEY_RECEIVERS, self.addr.as_slice(), bytes)
    }

    #[inline]
    fn set_balance(&self, storage: &mut dyn Storage, amount: u128) -> StdResult<()> {
        ns_save(storage, Self::NS_BALANCES, self.addr.as_slice(), Uint128::new(amount))
    }

    fn create_allowance_ns(&self) -> &[u8] {
        [ Self::PREFIX_ALLOWANCES, self.addr.as_slice() ].concat()
    }
}

use std::collections::HashMap;

use fadroma::cosmwasm_std::{Uint128, Coin, coin};
use super::{
    EnsembleResult, EnsembleError
};

pub type Balances = HashMap<String, Uint128>;

#[derive(Clone, Default, Debug)]
pub(crate) struct Bank(pub HashMap<String, Balances>);

impl Bank {
    pub fn add_funds(&mut self, address: &str, coin: Coin) {
        self.assert_account_exists(address);

        let account = self.0.get_mut(address).unwrap();
        add_balance(account, coin);
    }

    pub fn remove_funds(
        &mut self, 
        address: &str, 
        coin: Coin
    ) -> EnsembleResult<()> {
        if !self.0.contains_key(address) {
            return Err(EnsembleError::Bank(
                format!("Account {} does not exist for remove balance", address)
            ))
        }

        let account = self.0.get_mut(address).unwrap();
        let balance = account.get_mut(&coin.denom);
    
        match balance {
            Some(amount) => {
                if *amount >= coin.amount {
                    *amount -= coin.amount;
                } else {
                    return Err(EnsembleError::Bank(format!(
                        "Insufficient balance: account: {}, denom: {}, balance: {}, required: {}", 
                        address,
                        coin.denom,
                        amount,
                        coin.amount
                    )))
                }
            },
            None => {
                return Err(EnsembleError::Bank(format!(
                    "Insufficient balance: account: {}, denom: {}, balance: {}, required: {}",
                    address,
                    coin.denom,
                    Uint128::zero(),
                    coin.amount
                )))
            }
        }

        Ok(())
    }

    pub fn transfer(
        &mut self,
        from: &str,
        to: &str,
        coin: Coin,
    ) -> EnsembleResult<()> {
        self.assert_account_exists(from);
        self.assert_account_exists(to);

        let amount = self
            .0
            .get_mut(from)
            .unwrap()
            .get_mut(&coin.denom)
            .ok_or_else(|| {
                EnsembleError::Bank(format!(
                    "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                    from,
                    coin.denom,
                    Uint128::zero(),
                    coin.amount
                ))
            })?;

        *amount = amount.checked_sub(coin.amount).map_err(|_| {
            EnsembleError::Bank(format!(
                "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                from, coin.denom, amount, coin.amount
            ))
        })?;

        add_balance(self.0.get_mut(to).unwrap(), coin);

        Ok(())
    }

    pub fn query_balances(&self, address: &str, denom: Option<String>) -> Vec<Coin> {
        let account = self.0.get(address);

        match account {
            Some(account) => match denom {
                Some(denom) => {
                    let amount = account.get(&denom);

                    vec![coin(amount.cloned().unwrap_or_default().u128(), &denom)]
                }
                None => {
                    let mut result = Vec::new();

                    for (k, v) in account.iter() {
                        result.push(coin(v.u128(), k));
                    }

                    result
                }
            },
            None => match denom {
                Some(denom) => vec![coin(0, &denom)],
                None => vec![],
            },
        }
    }

    fn assert_account_exists(&mut self, address: &str) {
        if !self.0.contains_key(address) {
            self.0.insert(address.to_string(), Default::default());
        }
    }
}

fn add_balance(balances: &mut Balances, coin: Coin) {
    let balance = balances.get_mut(&coin.denom);

    if let Some(amount) = balance {
        *amount += coin.amount;
    } else {
        balances.insert(coin.denom, coin.amount);
    }
}

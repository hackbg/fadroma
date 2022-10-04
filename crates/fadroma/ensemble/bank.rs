use std::collections::HashMap;

use crate::prelude::*;
use super::response::BankResponse;

pub type Balances = HashMap<String, Uint128>;

#[derive(Clone, Default, Debug)]
pub(crate) struct Bank(pub(crate) HashMap<String, Balances>);

impl Bank {
    pub fn add_funds(&mut self, address: &str, coins: Vec<Coin>) {
        if coins.is_empty() {
            return;
        }

        self.assert_account_exists(address);

        let account = self.0.get_mut(address).unwrap();

        for coin in coins {
            add_balance(account, coin);
        }
    }

    pub fn remove_funds(
        &mut self, 
        address: &str, 
        coins: Vec<Coin>
    ) -> StdResult<()> {
        if coins.is_empty() {
            return Ok(());
        }

        if !self.0.contains_key(address) {
            return Err(StdError::not_found(
                format!("Account {} does not exist for remove balance", address)
            ))
        }

        let account = self.0.get_mut(address).unwrap();

        for coin in coins {
            let balance = account.get_mut(&coin.denom);
    
            match balance {
                Some(amount) => {
                    if *amount >= coin.amount {
                        *amount -= coin.amount;
                    } else {
                        return Err(StdError::generic_err(format!(
                            "Insufficient balance: account: {}, denom: {}, balance: {}, required: {}", 
                            address,
                            coin.denom,
                            amount,
                            coin.amount
                        )))
                    }
                },
                None => {
                    return Err(StdError::generic_err(format!(
                        "Insufficient balance: account: {}, denom: {}, balance: {}, required: {}",
                        address,
                        coin.denom,
                        Uint128::zero(),
                        coin.amount
                    )))
                }
            }
        }

        Ok(())
    }

    pub fn transfer(
        &mut self,
        from: &str,
        to: &str,
        coins: Vec<Coin>,
    ) -> StdResult<BankResponse> {
        let res = BankResponse {
            sender: from.to_string(),
            receiver: to.to_string(),
            coins: coins.clone()
        };

        if coins.is_empty() {
            return Ok(res);
        }

        self.assert_account_exists(from);
        self.assert_account_exists(to);

        for coin in coins {
            let amount = self
                .0
                .get_mut(from)
                .unwrap()
                .get_mut(&coin.denom)
                .ok_or_else(|| {
                    StdError::generic_err(format!(
                        "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                        from,
                        coin.denom,
                        Uint128::zero(),
                        coin.amount
                    ))
                })?;

            *amount = amount.checked_sub(coin.amount).map_err(|_| {
                StdError::generic_err(format!(
                    "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                    from, coin.denom, amount, coin.amount
                ))
            })?;

            add_balance(self.0.get_mut(to).unwrap(), coin);
        }

        Ok(res)
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

use std::collections::HashMap;

use fadroma_platform_scrt::{
    HumanAddr, Coin, Uint128, StdResult, StdError, coin
};

pub type Balances = HashMap<String, Uint128>;

#[derive(Clone, Default, Debug)]
pub(crate) struct Bank(pub(crate) HashMap<HumanAddr, Balances>);

impl Bank {
    pub fn add_funds(&mut self, address: &HumanAddr, coins: Vec<Coin>) {
        if coins.is_empty() {
            return;
        }
        
        self.assert_account_exists(address);

        let account = self.0.get_mut(address).unwrap();

        for coin in coins {
            add_balance(account, coin);
        }
    }

    pub fn transfer(
        &mut self,
        from: &HumanAddr,
        to: &HumanAddr,
        coins: Vec<Coin>
    ) -> StdResult<()> {
        if coins.is_empty() {
            return Ok(());
        }

        self.assert_account_exists(from);
        self.assert_account_exists(to);

        for coin in coins {
            let amount = self.0.get_mut(from).unwrap().get_mut(&coin.denom).ok_or_else(||
                StdError::generic_err(format!(
                    "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                    from,
                    coin.denom,
                    Uint128::zero(),
                    coin.amount
                ))
            )?;

            amount.0 = amount.0.checked_sub(coin.amount.0).ok_or_else(||
                StdError::generic_err(format!(
                    "Insufficient balance: sender: {}, denom: {}, balance: {}, required: {}",
                    from,
                    coin.denom,
                    amount,
                    coin.amount
                ))
            )?;

            add_balance(self.0.get_mut(to).unwrap(), coin);
        }

        Ok(())
    }

    pub fn query_balances(&self, address: &HumanAddr, denom: Option<String>) -> Vec<Coin> {
        let account = self.0.get(address);

        match account {
            Some(account) => {
                match denom {
                    Some(denom) => {
                        let amount = account.get(&denom);

                        vec![coin(amount.cloned().unwrap_or_default().0, &denom)]
                    }
                    None => {
                        let mut result = Vec::new();

                        for (k, v) in account.iter() {
                            result.push(coin(v.0, &k));
                        }

                        result
                    }
                }
            },
            None => vec![]
        }
    }

    fn assert_account_exists(&mut self, address: &HumanAddr) {
        if !self.0.contains_key(address) {
            self.0.insert(address.clone(), Default::default());
        }
    }
}

fn add_balance(balances: &mut Balances, coin: Coin) {
    let balance = balances.get_mut(&coin.denom);

    if let Some(amount) = balance {
        amount.0 += coin.amount.0;
    } else {
        balances.insert(coin.denom, coin.amount);
    }
}

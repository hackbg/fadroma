use crate::{
    cosmwasm_std::{DepsMut, Storage, Api, StdResult},
    crypto::{Prng, sha_256}
};

use super::state::{Account, PRNG_SEED};

pub struct Decoys {
    accounts: Vec<Account>,
    real_acc_pos: usize
}

pub struct Builder {
    rand: usize
}

impl Builder {
    pub fn new(storage: &mut dyn Storage, entropy: Option<impl AsRef<[u8]>>) -> StdResult<Self> {
        let entropy = entropy.and_then(
            |x| Some(sha_256(x.as_ref()))
        ).unwrap_or_default();

        let seed = PRNG_SEED.load_or_error(storage)?;
        let mut prng = Prng::new(&seed, &entropy);

        let mut new_contract_entropy = [0u8; 20];
        prng.fill_bytes(&mut new_contract_entropy);
    
        let new_prng_seed = sha_256(&new_contract_entropy);
        PRNG_SEED.save(storage, &new_prng_seed)?;

        Ok(Self {
            rand: prng.next_u64() as usize
        })
    }

    pub fn create(&self, api: &dyn Api, decoys: &[String]) -> StdResult<Option<Decoys>> {
        if decoys.len() == 0 {
            return Ok(None);
        }

        let real_acc_pos = self.rand % (decoys.len() + 1);
        
        Ok(Some(Decoys {
            real_acc_pos,
            accounts: decoys.iter()
                .map(|x| api.addr_canonicalize(x)
                    .and_then(|addr| Ok(Account::from(addr)))
                )
                .collect::<StdResult<Vec<Account>>>()?
        }))
    }
}

impl Decoys {
    #[inline]
    pub fn new(
        deps: DepsMut,
        decoys: &[String],
        entropy: Option<impl AsRef<[u8]>>
    ) -> StdResult<Option<Self>> {
        let builder = Builder::new(deps.storage, entropy)?;

        builder.create(deps.api, decoys)
    }

    /// Returns the index at which the real account will
    /// be shuffled in.
    #[inline]
    pub fn acc_index(&self) -> usize {
        self.real_acc_pos
    }

    /// Mixes the given `account` with the decoy accounts
    /// and returns an iterator over all of them.
    #[inline]
    pub fn shuffle_in<'a, 'b: 'a>(
        &'b self,
        account: &'a Account
    ) -> impl Iterator<Item = &'a Account> {
        let (lhs, rhs) = self.accounts.split_at(self.real_acc_pos);

        lhs.iter().chain([account]).chain(rhs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cosmwasm_std::testing::mock_dependencies;

    #[test]
    fn shuffles_account_in_the_correct_index() {
        let mut deps = mock_dependencies();
        let mut deps = deps.as_mut();

        PRNG_SEED.save(deps.storage, &[33; 32]).unwrap();

        let accounts = ["where", "light", "divides", "the", "holler"]
            .into_iter()
            .map(|x| String::from(x))
            .collect::<Vec<String>>();

        let account = Account::of(deps.api.addr_canonicalize("real_acc").unwrap());

        for i in 0..50 {
            let entropy = format!("entropy_{}", i);
            let decoys = Decoys::new(
                deps.branch(),
                &accounts,
                Some(entropy.as_bytes())
            ).unwrap().unwrap();

            for (i, acc) in decoys.shuffle_in(&account).enumerate() {
                if i == decoys.acc_index() {
                    assert_eq!(acc.addr(), account.addr());
                } else {
                    assert_ne!(acc.addr(), account.addr());
                }
            }
        }

        let mut decoys = Decoys::new(deps.branch(), &accounts, Some(b"entropy")).unwrap().unwrap();
        decoys.real_acc_pos = 0;

        let mut iter = decoys.shuffle_in(&account);
        assert_eq!(iter.next().unwrap().addr(), account.addr());
        drop(iter);

        decoys.real_acc_pos = accounts.len();

        let iter = decoys.shuffle_in(&account);
        assert_eq!(iter.last().unwrap().addr(), account.addr());
    }
}

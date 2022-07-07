use std::collections::HashMap;

use crate::prelude::*;
use super::response::StakingResponse;

#[derive(Clone, Default, Debug)]
pub(crate) struct DelegationWithUnbonding {
    delegator: HumanAddr,
    validator: HumanAddr,
    amount: Coin,
    unbonding_amount: Coin,
    can_redelegate: Coin,
    accumulated_rewards: Coin,
}

pub(crate) type Delegator = HashMap<HumanAddr, DelegationWithUnbonding>;

#[derive(Debug)]
pub(crate) struct Delegations {
    /// Denom for bonded currency
    bonded_denom: String,
    /// List of all valid validators
    validators: Vec<Validator>,
    /// Doubly hashed array of delegations for easy access
    delegators: HashMap<HumanAddr, Delegator>,
}

impl DelegationWithUnbonding {
    pub fn to_delegation(&self) -> Delegation {
        Delegation {
            delegator: self.delegator.clone(),
            validator: self.validator.clone(),
            amount: self.amount.clone(),
        }
    }

    pub fn to_full_delegation(&self) -> FullDelegation {
        FullDelegation {
            delegator: self.delegator.clone(),
            validator: self.validator.clone(),
            amount: self.amount.clone(),
            can_redelegate: self.can_redelegate.clone(),
            accumulated_rewards: self.accumulated_rewards.clone(),
        }
    }
}

impl Delegations {
    pub fn new<'a>(bonded_denom: String) -> Self {
        Self {
            bonded_denom,
            validators: Default::default(),
            delegators: Default::default(),
        }
    }

    pub fn add_validator(&mut self, new_validator: Validator) {
        self.validators.push(new_validator);
    }

    pub fn distribute_rewards(&mut self, amount: Uint128) {
        for delegator in self.delegators.iter_mut() {
            for delegation_pair in delegator.1 {
                let delegation = delegation_pair.1;
                let new_rewards = Coin {
                    denom: self.bonded_denom.clone(),
                    amount: delegation.accumulated_rewards.amount + amount,
                };
                delegation.accumulated_rewards = new_rewards;
            }
        }
    }

    pub fn fast_forward_waits(&mut self) -> Vec<Delegation> {
        let mut unbondings = vec![];
        for delegator in self.delegators.iter_mut() {
            for delegation_pair in delegator.1 {
                let delegation = delegation_pair.1;
                delegation.can_redelegate = delegation.amount.clone();
                if delegation.unbonding_amount.amount > Uint128::zero() {
                    unbondings.push(Delegation {
                        delegator: delegation.delegator.clone(),
                        validator: delegation.validator.clone(),
                        amount: delegation.unbonding_amount.clone()
                    });
                }
            }
        }
        unbondings
    }
    
    // Validator queries
    pub fn bonded_denom(&self) -> String {
        self.bonded_denom.clone()
    }

    pub fn all_delegations(&self, delegator: &HumanAddr) -> Vec<Delegation> {
        match self.delegators.get(delegator) {
            Some(delegations) => {
                let mut return_delegations: Vec<Delegation> = vec![];
                for delegation in delegations {
                    return_delegations.push((*delegation.1).to_delegation());
                }
                return_delegations
            }
            None => vec![]
        }
    }

    pub fn delegation(
        &self, 
        delegator: &HumanAddr, 
        validator: &HumanAddr
    ) -> Option<FullDelegation> {
        match self.get_delegation(delegator, validator) {
            Some(delegation) => Some(delegation.to_full_delegation()),
            None => None,
        }
    }

    pub fn validators(&self) -> Vec<Validator> {
        self.validators.clone()
    }

    pub fn unbonding_delegations(&self, delegator: &HumanAddr) -> Vec<Delegation> {
        match self.delegators.get(&delegator) {
            Some(delegations) => {
                let mut return_delegations: Vec<Delegation> = vec![];
                for delegation_pair in delegations {
                    let delegation = delegation_pair.1;
                    return_delegations.push(Delegation {
                        delegator: delegation.delegator.clone(),
                        validator: delegation.validator.clone(),
                        amount: delegation.unbonding_amount.clone(),
                    });    
                }
                return_delegations
            },
            None => vec![]
        }
    }

    pub fn rewards(&self, delegator: &HumanAddr) -> RewardsResponse {
        match self.delegators.get(delegator) {
            Some(delegations) => {
                let mut total = 0u128;
                for delegation_pair in delegations {
                    let delegation = delegation_pair.1;
                    total += delegation.accumulated_rewards.amount.u128();
                }
                
                // Cannot return any actual ValidatorRewards structs because the struct is
                // private at the moment.
                RewardsResponse {
                    rewards: vec![],
                    total: vec![Coin::new(total, &self.bonded_denom)],
                }
            },
            None => RewardsResponse {
                rewards: vec![],
                total: vec![],
            },
        }
    }

    // Validator transaction messages 
    pub fn delegate(
        &mut self, 
        delegator: &HumanAddr, 
        validator: &HumanAddr, 
        amount: Coin
    ) -> StdResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(StdError::generic_err("Incorrect coin denom"));
        }
        if !self.validate_validator(&validator) {
            return Err(StdError::not_found("Validator not found"));
        }
       
        let mut new_delegation = DelegationWithUnbonding {
            delegator: delegator.clone(),
            validator: validator.clone(),
            amount: amount.clone(),
            unbonding_amount: Coin {
                denom: self.bonded_denom.clone(),
                amount: Uint128::zero(),
            },
            can_redelegate: amount.clone(),
            accumulated_rewards: Coin {
                denom: self.bonded_denom.clone(),
                amount: Uint128::zero(),
            },
        };
       
        // Check if delegation pair exists, add amounts if so
        match self.delegators.get_mut(&delegator) {
            Some(cur_delegator) => {
                match cur_delegator.get(&validator) {
                    Some(ref old_deleg) => {
                        let old_delegation = (*old_deleg).clone();
                        new_delegation.amount = Coin {
                            denom: self.bonded_denom.clone(),
                            amount: old_delegation.amount.amount + amount.amount,
                        };
                        new_delegation.unbonding_amount = old_delegation.unbonding_amount;
                        new_delegation.can_redelegate = Coin {
                            denom: self.bonded_denom.clone(),
                            amount: old_delegation.can_redelegate.amount + amount.amount,
                        };
                        new_delegation.accumulated_rewards = old_delegation.accumulated_rewards;
                    },
                    None => { }
                }
            },
            None => { }
        };

        self.insert_delegation(&delegator, &validator, new_delegation);

        Ok(StakingResponse {
            sender: delegator.clone(),
            validator: validator.clone(),
            amount: amount.clone(),
        })
    }

    pub fn undelegate(
        &mut self,
        delegator: &HumanAddr,
        validator: &HumanAddr,
        amount: Coin
    ) -> StdResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(StdError::generic_err("Incorrect coin denom"));
        }

        match self.get_delegation(&delegator, &validator) {
            Some(delegation) => {
                if amount.amount > delegation.amount.amount {
                    return Err(StdError::generic_err("Insufficient funds"));
                }

                let mut new_can_redelegate = delegation.can_redelegate.clone();
                if delegation.can_redelegate.amount + amount.amount > delegation.amount.amount {
                    new_can_redelegate.amount = (delegation.can_redelegate.amount - amount.amount).unwrap();
                }

                let new_delegation = DelegationWithUnbonding {
                    delegator: delegator.clone(),
                    validator: validator.clone(),
                    amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: (delegation.amount.amount - amount.amount).unwrap(),
                    },
                    unbonding_amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: delegation.unbonding_amount.amount + amount.amount,
                    },
                    can_redelegate: new_can_redelegate,
                    accumulated_rewards: delegation.accumulated_rewards,
                };

                self.insert_delegation(&delegator, &validator, new_delegation);
                
                Ok(StakingResponse {
                    sender: delegator.clone(),
                    validator: validator.clone(),
                    amount: amount.clone(),
                })
            },
            None => Err(StdError::not_found("Delegation not found"))
        }
    }

    pub fn withdraw(
        &mut self,
        delegator: &HumanAddr,
        validator: &HumanAddr,
    ) -> StdResult<StakingResponse> { 
        match self.get_delegation(&delegator, &validator) {
            Some(delegation) => {
                let new_delegation = DelegationWithUnbonding {
                    delegator: delegator.clone(),
                    validator: validator.clone(),
                    amount: delegation.amount,
                    unbonding_amount: delegation.unbonding_amount,
                    can_redelegate: delegation.can_redelegate,
                    accumulated_rewards: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: Uint128::zero(),
                    },
                };
                self.insert_delegation(&delegator, &validator, new_delegation);
                
                Ok(StakingResponse {
                    sender: delegator.clone(),
                    validator: validator.clone(),
                    amount: delegation.accumulated_rewards.clone(),
                })
            },
            None => Err(StdError::not_found("Delegation not found"))
        }
    }

    pub fn redelegate(
        &mut self,
        delegator: &HumanAddr,
        src_validator: &HumanAddr,
        dst_validator: &HumanAddr,
        amount: Coin
        ) -> StdResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(StdError::generic_err("Incorrect coin denom"));
        }

        match self.get_delegation(&delegator, &src_validator) {
            Some(delegation) => {
                if amount.amount > delegation.amount.amount {
                    return Err(StdError::generic_err("Insufficient funds"));
                }

                if amount.amount > delegation.can_redelegate.amount {
                    return Err(StdError::generic_err("Insufficient funds to redelegate"));
                }

                if !self.validate_validator(&dst_validator) {
                    return Err(StdError::not_found("Destination validator does not exist"));
                }

                let new_src_delegation = DelegationWithUnbonding {
                    delegator: delegator.clone(),
                    validator: src_validator.clone(),
                    amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: (delegation.amount.amount - amount.amount).unwrap(),
                    },
                    unbonding_amount: delegation.unbonding_amount,
                    can_redelegate: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: (delegation.can_redelegate.amount - amount.amount).unwrap(),
                    },
                    accumulated_rewards: delegation.accumulated_rewards,
                };
                self.insert_delegation(&delegator, &src_validator, new_src_delegation);
                
                // Check if delegation already exists with dst validator
                match self.get_delegation(&delegator, &dst_validator) {
                    Some(mut dst_delegation) => {
                        dst_delegation.amount.amount += amount.amount;
                        self.insert_delegation(&delegator, &dst_validator, dst_delegation);
                    }
                    None => {
                        let new_dst_delegation = DelegationWithUnbonding {
                            delegator: delegator.clone(),
                            validator: dst_validator.clone(),
                            amount: Coin {
                                denom: self.bonded_denom.clone(),
                                amount: amount.amount,
                            },
                            unbonding_amount: Coin {
                                denom: self.bonded_denom.clone(),
                                amount: Uint128::zero(),
                            },
                            can_redelegate: Coin {
                                denom: self.bonded_denom.clone(),
                                amount: Uint128::zero(),
                            },
                            accumulated_rewards: Coin {
                                denom: self.bonded_denom.clone(),
                                amount: Uint128::zero(),
                            },
                        };
                        self.insert_delegation(&delegator, &dst_validator, new_dst_delegation);
                    }
                };
                
                Ok(StakingResponse {
                    sender: delegator.clone(),
                    validator: dst_validator.clone(),
                    amount: amount.clone(),
                })
            },
            None => Err(StdError::not_found("Delegation not found"))
        }

    }
    
    // Helper methods
    fn get_delegation(
        &self, 
        delegator: &HumanAddr, 
        validator: &HumanAddr,
    ) -> Option<DelegationWithUnbonding> {
        match self.delegators.get(&delegator) {
            Some(cur_delegator) => {
                match cur_delegator.get(&validator).clone() {
                    Some(ref delegation) => Some((*delegation).clone()),
                    _ => None,
                }
            },
            _ => None,
        }
    }

    fn insert_delegation(
        &mut self,
        delegator: &HumanAddr,
        validator: &HumanAddr,
        new_delegation: DelegationWithUnbonding
    ) -> Option<DelegationWithUnbonding> {
        match self.delegators.get_mut(&delegator) {
            Some(cur_delegator) => {
                cur_delegator.insert(validator.clone(), new_delegation)
            },
            None => {
                let mut new_delegator: Delegator = Default::default();
                new_delegator.insert(validator.clone(), new_delegation);
                self.delegators.insert(delegator.clone(), new_delegator);
                None
            },
        }
    }

    fn validate_validator(&self, validator: &HumanAddr) -> bool {
        for real_validator in self.validators.clone() {
            if real_validator.address == validator.into() {
                return true;
            }
        }
        false
    }

}

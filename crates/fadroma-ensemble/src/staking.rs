use std::collections::HashMap;

use crate::prelude::*;
use super::{
    EnsembleResult, EnsembleError,
    response::{
        StakingResponse, StakingOp,
        DistributionResponse, DistributionOp
    }
};

#[derive(Clone, Debug)]
pub(crate) struct DelegationWithUnbonding {
    delegator: String,
    validator: String,
    amount: Coin,
    unbonding_amount: Coin,
    can_redelegate: Coin,
    accumulated_rewards: Coin,
}

pub(crate) type Delegator = HashMap<String, DelegationWithUnbonding>;

#[derive(Debug)]
pub(crate) struct Delegations {
    /// Denom for bonded currency
    bonded_denom: String,
    /// List of all valid validators
    validators: Vec<Validator>,
    /// Doubly hashed array of delegations for easy access
    delegators: HashMap<String, Delegator>,
}

impl Into<Delegation> for DelegationWithUnbonding {
    fn into(self) -> Delegation {
        Delegation {
            delegator: Addr::unchecked(self.delegator),
            validator: self.validator,
            amount: self.amount,
        }
    }
}

impl Into<FullDelegation> for DelegationWithUnbonding {
    fn into(self) -> FullDelegation {
        FullDelegation {
            delegator: Addr::unchecked(self.delegator),
            validator: self.validator,
            amount: self.amount,
            can_redelegate: self.can_redelegate,
            accumulated_rewards: vec![self.accumulated_rewards],
        }
    }
}

impl Delegations {
    pub fn new(bonded_denom: String) -> Self {
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
                        delegator: Addr::unchecked(delegation.delegator.clone()),
                        validator: delegation.validator.to_string(),
                        amount: delegation.unbonding_amount.clone()
                    });
                }
            }
        }
        unbondings
    }
    
    // Validator queries
    pub fn bonded_denom(&self) -> &str {
        &self.bonded_denom
    }

    pub fn all_delegations(&self, delegator: &str) -> Vec<Delegation> {
        match self.delegators.get(delegator) {
            Some(delegations) => {
                let mut return_delegations: Vec<Delegation> = vec![];
                for delegation in delegations {
                    return_delegations.push(delegation.1.clone().into());
                }
                return_delegations
            }
            None => vec![]
        }
    }

    pub fn delegation(
        &self, 
        delegator: &str, 
        validator: &str
    ) -> Option<FullDelegation> {
        match self.get_delegation(delegator, validator) {
            Some(delegation) => Some(delegation.into()),
            None => None,
        }
    }

    pub fn validators(&self) -> &[Validator] {
        &self.validators
    }

    // Validator transaction messages 
    pub fn delegate(
        &mut self, 
        delegator: String, 
        validator: String, 
        amount: Coin
    ) -> EnsembleResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(EnsembleError::Staking("Incorrect coin denom".into()));
        }
        if !self.validate_validator(&validator) {
            return Err(EnsembleError::Staking("Validator not found".into()));
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

        self.insert_delegation(delegator.clone(), validator.clone(), new_delegation);

        Ok(StakingResponse {
            sender: delegator,
            amount,
            kind: StakingOp::Delegate {
                validator
            }
        })
    }

    pub fn undelegate(
        &mut self,
        delegator: String,
        validator: String,
        amount: Coin
    ) -> EnsembleResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(EnsembleError::Staking("Incorrect coin denom".into()));
        }

        match self.get_delegation(&delegator, &validator) {
            Some(delegation) => {
                if amount.amount > delegation.amount.amount {
                    return Err(EnsembleError::Staking("Insufficient funds".into()));
                }

                let mut new_can_redelegate = delegation.can_redelegate.clone();
                if delegation.can_redelegate.amount + amount.amount > delegation.amount.amount {
                    new_can_redelegate.amount = delegation.amount.amount - amount.amount;
                }

                let new_delegation = DelegationWithUnbonding {
                    delegator: delegator.clone(),
                    validator: validator.clone(),
                    amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: delegation.amount.amount - amount.amount,
                    },
                    unbonding_amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: delegation.unbonding_amount.amount + amount.amount,
                    },
                    can_redelegate: new_can_redelegate,
                    accumulated_rewards: delegation.accumulated_rewards,
                };

                self.insert_delegation(delegator.clone(), validator.clone(), new_delegation);
                
                Ok(StakingResponse {
                    sender: delegator,
                    amount,
                    kind: StakingOp::Undelegate {
                        validator
                    }
                })
            },
            None => Err(EnsembleError::Staking("Delegation not found".into()))
        }
    }

    pub fn withdraw(
        &mut self,
        delegator: String,
        validator: String,
    ) -> EnsembleResult<DistributionResponse> { 
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
                self.insert_delegation(delegator.clone(), validator.clone(), new_delegation);
                
                Ok(DistributionResponse {
                    sender: delegator,
                    kind: DistributionOp::WithdrawDelegatorReward {
                        validator,
                        reward: delegation.accumulated_rewards
                    }
                })
            },
            None => Err(EnsembleError::Staking("Delegation not found".into()))
        }
    }

    pub fn redelegate(
        &mut self,
        delegator: String,
        src_validator: String,
        dst_validator: String,
        amount: Coin
        ) -> EnsembleResult<StakingResponse> {
        if amount.denom != self.bonded_denom {
            return Err(EnsembleError::Staking("Incorrect coin denom".into()));
        }

        match self.get_delegation(&delegator, &src_validator) {
            Some(delegation) => {
                if amount.amount > delegation.amount.amount {
                    return Err(EnsembleError::Staking("Insufficient funds".into()));
                }

                if amount.amount > delegation.can_redelegate.amount {
                    return Err(EnsembleError::Staking("Insufficient funds to redelegate".into()));
                }

                if !self.validate_validator(&dst_validator) {
                    return Err(EnsembleError::Staking("Destination validator does not exist".into()));
                }

                let new_src_delegation = DelegationWithUnbonding {
                    delegator: delegator.clone(),
                    validator: src_validator.clone(),
                    amount: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: delegation.amount.amount - amount.amount,
                    },
                    unbonding_amount: delegation.unbonding_amount,
                    can_redelegate: Coin {
                        denom: self.bonded_denom.clone(),
                        amount: delegation.can_redelegate.amount - amount.amount,
                    },
                    accumulated_rewards: delegation.accumulated_rewards,
                };
                self.insert_delegation(delegator.clone(), src_validator.clone(), new_src_delegation);
                
                // Check if delegation already exists with dst validator
                match self.get_delegation(&delegator, &dst_validator) {
                    Some(mut dst_delegation) => {
                        dst_delegation.amount.amount += amount.amount;
                        self.insert_delegation(delegator.clone(), dst_validator.clone(), dst_delegation);
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
                        self.insert_delegation(delegator.clone(), dst_validator.clone(), new_dst_delegation);
                    }
                };
                
                Ok(StakingResponse {
                    sender: delegator,
                    amount,
                    kind: StakingOp::Redelegate {
                        src_validator,
                        dst_validator
                    }
                })
            },
            None => Err(EnsembleError::Staking("Delegation not found".into()))
        }

    }
    
    // Helper methods
    fn get_delegation(
        &self, 
        delegator: &str, 
        validator: &str,
    ) -> Option<DelegationWithUnbonding> {
        match self.delegators.get(delegator) {
            Some(cur_delegator) => {
                match cur_delegator.get(validator).clone() {
                    Some(ref delegation) => Some((*delegation).clone()),
                    _ => None,
                }
            },
            _ => None,
        }
    }

    fn insert_delegation(
        &mut self,
        delegator: String,
        validator: String,
        new_delegation: DelegationWithUnbonding
    ) -> Option<DelegationWithUnbonding> {
        match self.delegators.get_mut(&delegator) {
            Some(cur_delegator) => {
                cur_delegator.insert(validator, new_delegation)
            },
            None => {
                let mut new_delegator: Delegator = Default::default();
                new_delegator.insert(validator, new_delegation);
                self.delegators.insert(delegator, new_delegator);
                None
            },
        }
    }

    fn validate_validator(&self, validator: &str) -> bool {
        for real_validator in self.validators.iter() {
            if real_validator.address == *validator {
                return true;
            }
        }
        
        false
    }
}

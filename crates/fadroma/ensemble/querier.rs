use crate::prelude::{*, testing::MockQuerier};
use super::ensemble::Context;

pub struct EnsembleQuerier {
    // NOTE: raw pointer to crate::ensemble::ContractEnsemble::ctx
    ctx: *const Context,
    base: MockQuerier,
}

impl EnsembleQuerier {
    pub(crate) fn new(ctx: &Context) -> Self {
        Self {
            ctx,
            base: MockQuerier::new(&[]),
        }
    }
}

impl Querier for EnsembleQuerier {
    fn raw_query(&self, bin_request: &[u8]) -> QuerierResult {
        let request: QueryRequest<Empty> = match from_slice(bin_request) {
            Ok(v) => v,
            Err(e) => {
                return Err(SystemError::InvalidRequest {
                    error: format!("Parsing query request: {}", e),
                    request: bin_request.into(),
                })
            }
        };

        // NOTE: This is safe to dereference due it being 'boxed' in crate::ensemble::ContractEnsemble
        let ctx = unsafe { &*(self.ctx) };

        match request {
            QueryRequest::Wasm(query) => match query {
                WasmQuery::Smart {
                    contract_addr, msg, ..
                } => {
                    if !ctx.instances.contains_key(&contract_addr) {
                        return Err(SystemError::NoSuchContract {
                            addr: contract_addr,
                        });
                    }

                    Ok(ctx.query(contract_addr, msg))
                }
                WasmQuery::Raw { contract_addr, .. } => {
                    if !ctx.instances.contains_key(&contract_addr) {
                        return Err(SystemError::NoSuchContract {
                            addr: contract_addr,
                        });
                    }

                    todo!()
                }
            },
            QueryRequest::Bank(query) => match query {
                BankQuery::AllBalances { address } => {
                    let amount = ctx.bank.readable().query_balances(&address, None);

                    Ok(to_binary(&AllBalanceResponse { amount }))
                }
                BankQuery::Balance { address, denom } => {
                    let amount = ctx.bank.readable().query_balances(&address, Some(denom));

                    Ok(to_binary(&BalanceResponse {
                        amount: amount.into_iter().next().unwrap(),
                    }))
                }
            },
            QueryRequest::Staking(query) => match query {
                StakingQuery::AllDelegations { delegator } => {
                    let delegations = ctx.delegations.all_delegations(delegator);

                    Ok(to_binary(&AllDelegationsResponse { delegations }))
                },
                StakingQuery::BondedDenom {} => {
                    let denom = ctx.delegations.bonded_denom();

                    Ok(to_binary(&BondedDenomResponse { denom }))
                },
                StakingQuery::Delegation { delegator, validator } => {
                    let delegation = ctx.delegations.delegation(delegator, validator);

                    // TODO: Look into why DelegationResponse is not supported
                    Ok(to_binary(&DelegationResponse { delegation }));
                    Err(SystemError::Unknown {  })
                },
                StakingQuery::UnbondingDelegations { delegator } => {
                    let delegations = ctx.delegations.unbonding_delegations(delegator);

                    Ok(to_binary(&UnbondingDelegationsResponse { delegations }))
                },
                StakingQuery::Validators {} => {
                    let validators = ctx.delegations.validators();

                    Ok(to_binary(&ValidatorsResponse { validators }))
                },
            },
            _ => {
                Ok(self.base.query(&request))
            },
        }
    }
}

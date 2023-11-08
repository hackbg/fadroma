use super::ensemble::Context;
use fadroma::cosmwasm_std::{
    Querier, QueryRequest, WasmQuery, BankQuery, QuerierResult, SystemResult,
    SystemError, ContractResult, Empty, AllBalanceResponse, BalanceResponse,
    from_slice, to_binary, testing::MockQuerier
};
#[cfg(feature = "ensemble-staking")]
use crate::cosmwasm_std::{
    ValidatorResponse, AllValidatorsResponse, AllDelegationsResponse,
    BondedDenomResponse, StakingQuery
};

pub struct EnsembleQuerier {
    ctx: *const Context,
    base: MockQuerier
}

impl EnsembleQuerier {
    pub(crate) fn new(ctx: &Context) -> Self {
        Self {
            ctx,
            base: MockQuerier::new(&[])
        }
    }
}

macro_rules! querier_result {
    ($x:expr) => {
        {
            let result = match $x {
                Ok(bin) => ContractResult::Ok(bin),
                Err(err) => ContractResult::Err(err.to_string())
            };
        
            SystemResult::Ok(result)
        }
    };
}

impl Querier for EnsembleQuerier {
    fn raw_query(&self, bin_request: &[u8]) -> QuerierResult {
        let request: QueryRequest<Empty> = match from_slice(bin_request) {
            Ok(v) => v,
            Err(e) => {
                return SystemResult::Err(SystemError::InvalidRequest {
                    error: format!("Parsing query request: {}", e),
                    request: bin_request.into(),
                })
            }
        };

        let ctx = unsafe { &*(self.ctx) };

        match request {
            QueryRequest::Wasm(query) => match query {
                WasmQuery::Smart {
                    contract_addr, msg, ..
                } => {
                    if ctx.state.instance(&contract_addr).is_err() {
                        return SystemResult::Err(SystemError::NoSuchContract {
                            addr: contract_addr
                        });
                    }

                    querier_result!(ctx.query(&contract_addr, msg))
                }
                WasmQuery::Raw { contract_addr, .. } => {
                    if cfg!(feature = "scrt") {
                        panic!("Raw queries are unsupported in Secret Network - keys and values in raw storage are encrypted and must be queried through a smart query.");
                    } else {
                        if ctx.state.instance(&contract_addr).is_err() {
                            return SystemResult::Err(SystemError::NoSuchContract {
                                addr: contract_addr
                            });
                        }
    
                        todo!()
                    }
                }
                _ => unimplemented!(),
            },
            QueryRequest::Bank(query) => match query {
                BankQuery::AllBalances { address } => {
                    let amount = ctx.state.bank.query_balances(&address, None);

                    querier_result!(to_binary(&AllBalanceResponse { amount }))
                }
                BankQuery::Balance { address, denom } => {
                    let amount = ctx.state.bank.query_balances(&address, Some(denom));

                    querier_result!(to_binary(&BalanceResponse {
                        amount: amount.into_iter().next().unwrap()
                    }))
                }
                _ => unimplemented!(),
            },
            #[cfg(feature = "ensemble-staking")]
            QueryRequest::Staking(query) => match query {
                StakingQuery::AllDelegations { delegator } => {
                    let delegations = ctx.delegations.all_delegations(&delegator);

                    querier_result!(to_binary(&AllDelegationsResponse { delegations }))
                }
                StakingQuery::BondedDenom {} => {
                    let denom = ctx.delegations.bonded_denom();

                    querier_result!(to_binary(&BondedDenomResponse {
                        denom: denom.to_string(),
                    }))
                }
                StakingQuery::Delegation {
                    delegator,
                    validator
                } => {
                    let delegation = ctx.delegations.delegation(&delegator, &validator);

                    querier_result!(to_binary(&delegation))
                }
                StakingQuery::AllValidators {} => {
                    let validators = ctx.delegations.validators();

                    querier_result!(to_binary(&AllValidatorsResponse {
                        validators: validators.to_vec(),
                    }))
                }
                StakingQuery::Validator { address } => {
                    let validator = ctx
                        .delegations
                        .validators()
                        .iter()
                        .filter(|validator| validator.address == address)
                        .next()
                        .cloned();

                    querier_result!(to_binary(&ValidatorResponse { validator }))
                }
                _ => unimplemented!(),
            },
            _ => self.base.handle_query(&request)
        }
    }
}

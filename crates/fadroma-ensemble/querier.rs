use fadroma_platform_scrt::{
    from_slice, testing::MockQuerier, to_binary, AllBalanceResponse, BalanceResponse, BankQuery,
    Empty, Querier, QuerierResult, QueryRequest, SystemError, WasmQuery,
};

use crate::ensemble::Context;

pub struct EnsembleQuerier {
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

        match request {
            QueryRequest::Wasm(query) => match query {
                WasmQuery::Smart {
                    contract_addr, msg, ..
                } => unsafe {
                    let ctx = &*(self.ctx);

                    if !ctx.instances.contains_key(&contract_addr) {
                        return Err(SystemError::NoSuchContract {
                            addr: contract_addr,
                        });
                    }

                    Ok(ctx.query(contract_addr, msg))
                },
                WasmQuery::Raw { contract_addr, .. } => unsafe {
                    let ctx = &*(self.ctx);

                    if !ctx.instances.contains_key(&contract_addr) {
                        return Err(SystemError::NoSuchContract {
                            addr: contract_addr,
                        });
                    }

                    todo!()
                },
            },
            QueryRequest::Bank(query) => match query {
                BankQuery::AllBalances { address } => unsafe {
                    let ctx = &*(self.ctx);

                    let amount = ctx.bank.readable().query_balances(&address, None);

                    Ok(to_binary(&AllBalanceResponse { amount }))
                },
                BankQuery::Balance { address, denom } => unsafe {
                    let ctx = &*(self.ctx);

                    let amount = ctx.bank.readable().query_balances(&address, Some(denom));

                    Ok(to_binary(&BalanceResponse {
                        amount: amount.into_iter().next().unwrap(),
                    }))
                },
            },
            _ => Ok(self.base.query(&request)),
        }
    }
}

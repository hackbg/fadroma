use std::str::from_utf8;
use serde::de::DeserializeOwned;
use crate::scrt::*;

/// Successful transaction return a vector of relevant messages and a count of any others
pub type TxResult = StdResult<(Vec<String>, usize, usize)>;

//pub struct Contract <S: Storage, A: Api, Q: Querier, InitMsg, TXMsg, QueryMsg> {
    //init:   fn (DepsMut, Env, InitMsg)   -> StdResult<Response>,
    //handle: fn (DepsMut, Env, TXMsg)     -> StdResult<Response>,
    //query:  fn (Deps, QueryMsg)          -> StdResult<QueryResponse>,
//}

pub type InitFn   <M> = fn (DepsMut, Env, MessageInfo, M) -> StdResult<Response>;
pub type HandleFn <M> = fn (DepsMut, Env, MessageInfo, M) -> StdResult<Response>;
pub type QueryFn  <M> = fn (Deps, M) -> StdResult<QueryResponse>;

/// Reusable test harness with overridable post processing
/// for init and tx response messages.
pub trait Harness <Q: Querier, InitMsg, TXMsg, QueryMsg, Resp: DeserializeOwned> {

    fn deps       (&self)     -> Deps;
    fn deps_mut   (&mut self) -> DepsMut;
    fn get_init   (&mut self) -> InitFn<InitMsg>;
    fn get_handle (&mut self) -> HandleFn<TXMsg>;
    fn get_query  (&self)     -> QueryFn<QueryMsg>;

    fn init (&mut self, height: u64, agent: Addr, msg: InitMsg) -> TxResult {
        (self.get_init())(
            self.deps_mut(),
            Env {
                block:    BlockInfo    { height,  time: Timestamp::from_seconds(height * 5), chain_id: "secret".into() },
                contract: ContractInfo { address: Addr::unchecked("contract_addr"), code_hash: "contract_hash".into() }
            },
            MessageInfo {
                sender: agent,
                funds: Vec::new()
            },
            msg
        ).map(|result|Self::postprocess_init(result))?
    }

    fn postprocess_init (result: Response) -> TxResult {
        let mut relevant = vec![];
        let mut other    = 0;
        let mut invalid  = 0;
        for msg in result.messages.iter() {
            match &msg.msg {
                CosmosMsg::Wasm(wasm_msg) => match wasm_msg {
                    WasmMsg::Execute { msg, .. } => match from_utf8(msg.as_slice()) {
                        Ok(msg) => relevant.push(msg.trim().into()),
                        Err(_) => invalid += 1,
                    },
                    _ => other += 1
                },
                _ => other += 1
            }
        }
        Ok((relevant, other, invalid))
    }

    fn tx (&mut self, height: u64, agent: Addr, tx: TXMsg) -> TxResult {
        (self.get_handle())(
            self.deps_mut(),
            Env {
                block:    BlockInfo    { height,  time: Timestamp::from_seconds(height * 5), chain_id: "secret".into() },
                contract: ContractInfo { address: Addr::unchecked("contract_addr"), code_hash: "contract_hash".into() }
            },
            MessageInfo {
                sender: agent,
                funds: Vec::new()
            },
            tx
        ).map(|result|Self::postprocess_tx(result))?
    }

    fn postprocess_tx (result: Response) -> TxResult {
        let mut relevant = vec![];
        let mut other    = 0;
        let mut invalid  = 0;
        for msg in result.messages.iter() {
            match &msg.msg {
                CosmosMsg::Wasm(wasm_msg) => match wasm_msg {
                    WasmMsg::Execute { msg, .. } => match from_utf8(msg.as_slice()) {
                        Ok(msg) => relevant.push(msg.trim().into()),
                        Err(_)  => invalid += 1,
                    },
                    _ => other += 1
                },
                _ => other += 1
            }
        }
        Ok((relevant, other, invalid))
    }

    fn q (&self, q: QueryMsg) -> StdResult<Resp> {
        match (self.get_query())(self.deps(), q) {
            Ok(response) => from_binary(&response),
            Err(e)       => Err(e)
        }
    }
}

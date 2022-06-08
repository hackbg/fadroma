use std::str::from_utf8;
use serde::de::DeserializeOwned;
use fadroma_platform_scrt::cosmwasm_std::{
    StdResult, Binary, InitResponse, HandleResponse, Env, HumanAddr,
    BlockInfo, MessageInfo, CosmosMsg, WasmMsg, ContractInfo, Querier,
    from_binary
};

/// Successful transaction return a vector of relevant messages and a count of any others
pub type TxResult = StdResult<(Vec<String>, usize, usize)>;

//pub struct Contract <S: Storage, A: Api, Q: Querier, InitMsg, TXMsg, QueryMsg> {
    //init:   fn (&Extern<S, A, Q>, Env, InitMsg)   -> StdResult<InitResponse>,
    //handle: fn (&mut Extern<S, A, Q>, Env, TXMsg) -> StdResult<HandleResponse>,
    //query:  fn (&Extern<S, A, Q>, QueryMsg)       -> StdResult<Binary>,
//}

pub type InitFn   <D, M> = fn (&mut D, Env, M) -> StdResult<InitResponse>;
pub type HandleFn <D, M> = fn (&mut D, Env, M) -> StdResult<HandleResponse>;
pub type QueryFn  <D, M> = fn (&D, M) -> StdResult<Binary>;

/// Reusable test harness with overridable post processing
/// for init and tx response messages.
pub trait Harness <Q: Querier, InitMsg, TXMsg, QueryMsg, Response: DeserializeOwned> {

    type Deps;
    fn deps       (&self)     -> &Self::Deps;
    fn deps_mut   (&mut self) -> &mut Self::Deps;
    fn get_init   (&mut self) -> InitFn<Self::Deps,   InitMsg>;
    fn get_handle (&mut self) -> HandleFn<Self::Deps, TXMsg>;
    fn get_query  (&self)     -> QueryFn<Self::Deps,  QueryMsg>;

    fn init (&mut self, height: u64, agent: &HumanAddr, msg: InitMsg) -> TxResult {
        (self.get_init())(self.deps_mut(), Env {
            block:    BlockInfo    { height, time: height * 5, chain_id: "secret".into() },
            message:  MessageInfo  { sender: agent.into(), sent_funds: vec![] },
            contract: ContractInfo { address: "contract_addr".into() },
            contract_key:       Some("contract_key".into()),
            contract_code_hash: "contract_hash".into()
        }, msg).map(|result|Self::postprocess_init(result))?
    }

    fn postprocess_init (result: InitResponse) -> TxResult {
        let mut relevant = vec![];
        let mut other    = 0;
        let mut invalid  = 0;
        for cosmos_msg in result.messages.iter() {
            match cosmos_msg {
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

    fn tx (&mut self, height: u64, agent: &HumanAddr, tx: TXMsg) -> TxResult {
        (self.get_handle())(self.deps_mut(), Env {
            block:    BlockInfo    { height, time: height * 5, chain_id: "secret".into() },
            message:  MessageInfo  { sender: agent.into(), sent_funds: vec![] },
            contract: ContractInfo { address: "contract_addr".into() },
            contract_key:       Some("contract_key".into()),
            contract_code_hash: "contract_hash".into()
        }, tx).map(|result|Self::postprocess_tx(result))?
    }

    fn postprocess_tx (result: HandleResponse) -> TxResult {
        let mut relevant = vec![];
        let mut other    = 0;
        let mut invalid  = 0;
        for cosmos_msg in result.messages.iter() {
            match cosmos_msg {
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

    fn q (&self, q: QueryMsg) -> StdResult<Response> {
        match (self.get_query())(self.deps(), q) {
            Ok(response) => from_binary(&response),
            Err(e)       => Err(e)
        }
    }
}

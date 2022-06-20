use crate::{
    prelude::ContractLink,
    cosmwasm_std::{HumanAddr, Binary, InitResponse, HandleResponse, Coin}
};

#[derive(Clone, Debug)]
pub enum Response {
    Instantiate(InstantiateResponse),
    Execute(ExecuteResponse),
    Bank(BankResponse)
}

#[derive(Clone, Debug)]
pub struct InstantiateResponse {
    /// The address that triggered the instantiation.
    pub sender: HumanAddr,
    /// The address and code hash of the new instance.
    pub instance: ContractLink<HumanAddr>,
    /// The init message that was sent.
    pub msg: Binary,
    /// The init response returned by the contract.
    pub response: InitResponse,
    /// The responses for any messages that the instantiated contract initiated.
    pub sent: Vec<Response>
}

#[derive(Clone, Debug)]
pub struct ExecuteResponse {
    /// The address that triggered the instantiation.
    pub sender: HumanAddr,
    /// The contract that was called.
    pub target: HumanAddr,
    /// The execute message that was sent.
    pub msg: Binary,
    /// The execute response returned by the contract.
    pub response: HandleResponse,
    /// The responses for any messages that the executed contract initiated.
    pub sent: Vec<Response>
}

#[derive(Clone, Debug)]
pub struct BankResponse {
    /// The address that sent the funds.
    pub sender: HumanAddr,
    /// The address that the funds were sent to.
    pub receiver: HumanAddr,
    /// The funds that were sent.
    pub coins: Vec<Coin>
}

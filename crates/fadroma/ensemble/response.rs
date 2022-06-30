use std::iter::Iterator;

use crate::{
    prelude::ContractLink,
    cosmwasm_std::{HumanAddr, Binary, InitResponse, HandleResponse, Coin}
};

#[derive(Clone, PartialEq, Debug)]
pub enum Response {
    Instantiate(InstantiateResponse),
    Execute(ExecuteResponse),
    Bank(BankResponse),
    Staking(StakingResponse),
}

#[derive(Clone, PartialEq, Debug)]
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

#[derive(Clone, PartialEq, Debug)]
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

#[derive(Clone, PartialEq, Debug)]
pub struct BankResponse {
    /// The address that sent the funds.
    pub sender: HumanAddr,
    /// The address that the funds were sent to.
    pub receiver: HumanAddr,
    /// The funds that were sent.
    pub coins: Vec<Coin>
}

#[derive(Clone, PartialEq, Debug)]
pub struct StakingResponse {
    /// The address that delegated the funds.
    pub delegator: HumanAddr,
    /// The address of the validator where the funds were sent.
    pub validator: HumanAddr,
    /// The funds that were sent.
    pub amount: Coin,
}


pub struct Iter<'a> {
    responses: &'a [Response],
    index: usize,
    stack: Vec<&'a Response>
}

impl InstantiateResponse {
    /// Returns an iterator that iterates over this instance's child responses.
    /// Iteration follows the message execution order.
    pub fn iter(&self) -> Iter<'_> {
        Iter::new(&self.sent)
    }
}

impl ExecuteResponse {
    /// Returns an iterator that iterates over this instance's child responses.
    /// Iteration follows the message execution order.
    pub fn iter(&self) -> Iter<'_> {
        Iter::new(&self.sent)
    }
}

impl Response {
    #[inline]
    pub fn is_instantiate(&self) -> bool {
        matches!(&self, Self::Instantiate(_))
    }

    #[inline]
    pub fn is_execute(&self) -> bool {
        matches!(&self, Self::Execute(_))
    }

    #[inline]
    pub fn is_bank(&self) -> bool {
        matches!(&self, Self::Bank(_))
    }
}

impl From<InstantiateResponse> for Response {
    #[inline]
    fn from(value: InstantiateResponse) -> Self {
        Self::Instantiate(value)
    }
}

impl From<ExecuteResponse> for Response {
    #[inline]
    fn from(value: ExecuteResponse) -> Self {
        Self::Execute(value)
    }
}

impl From<BankResponse> for Response {
    #[inline]
    fn from(value: BankResponse) -> Self {
        Self::Bank(value)
    }
}

impl<'a> Iter<'a> {
    /// Yields all responses that were initiated by the given `sender`.
    pub fn by_sender(self, sender: impl Into<HumanAddr>) -> impl Iterator<Item = &'a Response> {
        let sender = sender.into();

        self.filter(move |x| match x {
            Response::Instantiate(resp) => resp.sender == sender,
            Response::Execute(resp) => resp.sender == sender,
            Response::Bank(resp) => resp.sender == sender
        })
    }

    fn new(responses: &'a [Response]) -> Self {
        Self {
            responses,
            index: 0,
            stack: vec![]
        }
    }

    fn enqueue_children(&mut self, node: &'a Response) {
        match node {
            Response::Execute(resp) =>
                self.stack.extend(resp.sent.iter().rev()),
            Response::Instantiate(resp) =>
                self.stack.extend(resp.sent.iter().rev()),
            Response::Bank(_) => { }
        }
    }
}

impl<'a> Iterator for Iter<'a> {
    type Item = &'a Response;

    fn next(&mut self) -> Option<Self::Item> {
        if self.stack.is_empty() {
            if self.index < self.responses.len() {
                let node = &self.responses[self.index];

                self.enqueue_children(node);
                self.index += 1;

                return Some(node);
            }

            return None;
        }

        if let Some(node) = self.stack.pop() {
            self.enqueue_children(node);

            Some(node)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::cell::RefCell;
    use crate::cosmwasm_std::Uint128;

    thread_local!(static MSG_INDEX: RefCell<usize> = RefCell::new(0));

    #[test]
    fn iterate() {
        let resp = mock_response();
        let mut iter = resp.iter();

        assert_eq!(resp.sent.len(), 3);
        assert_eq!(iter.next().unwrap(), &resp.sent[0]);

        if let Response::Instantiate(inst) = &resp.sent[0] {
            assert_eq!(inst.sent.len(), 3);
            assert_eq!(iter.next().unwrap(), &inst.sent[0]);

            if let Response::Instantiate(inst_2) = &inst.sent[0] {
                assert_eq!(inst_2.sent.len(), 2);
                assert_eq!(iter.next().unwrap(), &inst_2.sent[0]);
                assert_eq!(iter.next().unwrap(), &inst_2.sent[1]);

                if let Response::Execute(exec) = &inst_2.sent[0] {
                    assert_eq!(exec.sender, "C".into());
                    assert_eq!(exec.target, "D".into());
                    assert_eq!(exec.sent.len(), 0);
                } else {
                    panic!()
                }

                if let Response::Execute(exec) = &inst_2.sent[1] {
                    assert_eq!(exec.sender, "C".into());
                    assert_eq!(exec.target, "B".into());
                    assert_eq!(exec.sent.len(), 0);
                } else {
                    panic!()
                }
            } else {
                panic!()
            }

            assert_eq!(iter.next().unwrap(), &inst.sent[1]);
            if let Response::Execute(exec) = &inst.sent[1] {
                assert_eq!(exec.sender, "B".into());
                assert_eq!(exec.target, "D".into());
                assert_eq!(exec.sent.len(), 0);
            } else {
                panic!()
            }

            assert_eq!(iter.next().unwrap(), &inst.sent[2]);
            if let Response::Execute(exec) = &inst.sent[2] {
                assert_eq!(exec.sender, "B".into());
                assert_eq!(exec.target, "A".into());
                assert_eq!(exec.sent.len(), 0);
            } else {
                panic!()
            }
        } else {
            panic!()
        }

        assert_eq!(iter.next().unwrap(), &resp.sent[1]);
        if let Response::Execute(exec) = &resp.sent[1] {
            assert_eq!(exec.sent.len(), 1);
            assert_eq!(iter.next().unwrap(), &exec.sent[0]);

            if let Response::Bank(bank) = &exec.sent[0] {
                assert_eq!(bank.sender, "C".into());
                assert_eq!(bank.receiver, "B".into());
            } else {
                panic!()
            }
        } else {
            panic!()
        }

        assert_eq!(iter.next().unwrap(), &resp.sent[2]);
        if let Response::Bank(bank) = &resp.sent[2] {
            assert_eq!(bank.sender, "A".into());
            assert_eq!(bank.receiver, "D".into());
        } else {
            panic!()
        }

        assert_eq!(iter.next(), None);
    }

    #[test]
    fn filter_by_sender() {
        let resp = mock_response();
        let mut iter = resp.iter().by_sender("B");

        if let Response::Instantiate(inst) = &resp.sent[0] {
            assert_eq!(iter.next().unwrap(), &inst.sent[0]);
            assert_eq!(iter.next().unwrap(), &inst.sent[1]);
            assert_eq!(iter.next().unwrap(), &inst.sent[2]);
            assert_eq!(iter.next(), None);
        } else {
            panic!()
        }

        let mut iter = resp.iter().by_sender("C");

        if let Response::Execute(exec) = iter.next().unwrap() {
            assert_eq!(exec.sender, "C".into());
            assert_eq!(exec.target, "D".into());
            assert_eq!(exec.msg, Binary::from(b"message_3"));
            assert_eq!(exec.sent.len(), 0);
        } else {
            panic!()
        }

        if let Response::Execute(exec) = iter.next().unwrap() {
            assert_eq!(exec.sender, "C".into());
            assert_eq!(exec.target, "B".into());
            assert_eq!(exec.msg, Binary::from(b"message_4"));
            assert_eq!(exec.sent.len(), 0);
        } else {
            panic!()
        }

        if let Response::Bank(bank) = iter.next().unwrap() {
            assert_eq!(bank.sender, "C".into());
            assert_eq!(bank.receiver, "B".into());
            assert_eq!(bank.coins[0].amount, Uint128(800));
        } else {
            panic!()
        }

        assert_eq!(iter.next(), None);
    }

    fn mock_response() -> ExecuteResponse {
        // sender exec A
        //   A inst B                 
        //     B inst C
        //       C exec D
        //       C exec B
        //     B exec D
        //     B exec A
        //   A exec C
        //     C send B
        //   A send D

        let mut resp = execute_resp("sender", "A");

        let mut instantiate = instantiate_resp("A");

        let mut instantiate_2 = instantiate_resp("B");
        instantiate_2.sent.push(execute_resp("C", "D").into());
        instantiate_2.sent.push(execute_resp("C", "B").into());

        instantiate.sent.push(instantiate_2.into());
        instantiate.sent.push(execute_resp("B", "D").into());
        instantiate.sent.push(execute_resp("B", "A").into());

        resp.sent.push(instantiate.into());

        let mut exec = execute_resp("A", "C");
        exec.sent.push(bank_resp("C", "B").into());

        resp.sent.push(exec.into());
        resp.sent.push(bank_resp("A", "D").into());

        MSG_INDEX.with(|x| { *x.borrow_mut() = 0; });

        resp
    }

    fn execute_resp(sender: impl Into<HumanAddr>, target: impl Into<HumanAddr>) -> ExecuteResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        let resp = ExecuteResponse {
            sender: sender.into(),
            target: target.into(),
            msg: Binary::from(format!("message_{}", index).as_bytes()),
            response: HandleResponse::default(),
            sent: vec![]
        };

        MSG_INDEX.with(|x| { *x.borrow_mut() += 1; });

        resp
    }

    fn instantiate_resp(sender: impl Into<HumanAddr>) -> InstantiateResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        let resp = InstantiateResponse {
            sender: sender.into(),
            instance: ContractLink::default(),
            msg: Binary::from(format!("message_{}", index).as_bytes()),
            response: InitResponse::default(),
            sent: vec![]
        };

        MSG_INDEX.with(|x| { *x.borrow_mut() += 1; });

        resp
    }

    fn bank_resp(sender: impl Into<HumanAddr>, to: impl Into<HumanAddr>) -> BankResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        BankResponse {
            sender: sender.into(),
            receiver: to.into(),
            coins: vec![Coin {
                denom: "uscrt".into(),
                amount: Uint128(100 * index as u128)
            }]
        }
    }
}

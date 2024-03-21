use std::iter::Iterator;

use fadroma::{
    prelude::ContractLink,
    cosmwasm_std::{Addr, Binary, Response, Coin, Reply, SubMsg}
};

#[derive(Clone, PartialEq, Debug)]
#[non_exhaustive]
pub enum ResponseVariants {
    Instantiate(InstantiateResponse),
    Execute(ExecuteResponse),
    Reply(ReplyResponse),
    Bank(BankResponse),
    #[cfg(feature = "ensemble-staking")]
    Staking(StakingResponse),
    #[cfg(feature = "ensemble-staking")]
    Distribution(DistributionResponse)
}

#[derive(Clone, PartialEq, Debug)]
pub struct InstantiateResponse {
    /// The address that triggered the instantiation.
    pub sender: String,
    /// The address and code hash of the new instance.
    pub instance: ContractLink<Addr>,
    /// Code ID of the instantiated contract.
    pub code_id: u64,
    /// The init message that was sent.
    pub msg: Binary,
    /// The init response returned by the contract.
    pub response: Response,
    /// The responses for any messages that the instantiated contract initiated.
    pub sent: Vec<ResponseVariants>
}

#[derive(Clone, PartialEq, Debug)]
pub struct ExecuteResponse {
    /// The address that triggered the execute.
    pub sender: String,
    /// The contract that was called.
    pub address: String,
    /// The execute message that was sent.
    pub msg: Binary,
    /// The execute response returned by the contract.
    pub response: Response,
    /// The responses for any messages that the executed contract initiated.
    pub sent: Vec<ResponseVariants>
}

#[derive(Clone, PartialEq, Debug)]
pub struct ReplyResponse {
    /// The contract that was called.
    pub address: String,
    /// The execute message that was sent.
    pub reply: Reply,
    /// The execute response returned by the contract.
    pub response: Response,
    /// The responses for any messages that the executed contract initiated.
    pub sent: Vec<ResponseVariants>
}

#[derive(Clone, PartialEq, Debug)]
pub struct BankResponse {
    /// The address that sent the funds.
    pub sender: String,
    /// The address that the funds were sent to.
    pub receiver: String,
    /// The funds that were sent.
    pub coins: Vec<Coin>
}

#[cfg(feature = "ensemble-staking")]
#[derive(Clone, PartialEq, Debug)]
pub struct StakingResponse {
    /// The address that delegated the funds.
    pub sender: String,
    /// The funds that were sent.
    pub amount: Coin,
    /// The kind of staking operation that was performed.
    pub kind: StakingOp
}

#[cfg(feature = "ensemble-staking")]
#[derive(Clone, PartialEq, Debug)]
#[non_exhaustive]
pub enum StakingOp {
    Delegate {
        /// The address of the validator where the funds were sent.
        validator: String
    },
    Undelegate {
        /// The address of the validator where the funds were sent.
        validator: String
    },
    Redelegate {
        /// The address of the validator that the funds were redelegated from.
        src_validator: String,
        /// The address of the validator that the funds were redelegated to.
        dst_validator: String
    }
}

#[cfg(feature = "ensemble-staking")]
#[derive(Clone, PartialEq, Debug)]
pub struct DistributionResponse {
    /// The address that delegated the funds.
    pub sender: String,
    /// The kind of staking operation that was performed.
    pub kind: DistributionOp
}

#[cfg(feature = "ensemble-staking")]
#[derive(Clone, PartialEq, Debug)]
#[non_exhaustive]
pub enum DistributionOp {
    WithdrawDelegatorReward {
        /// The funds that were sent.
        reward: Coin,
        /// The address of the validator that the rewards where withdrawn from.
        validator: String
    },
    SetWithdrawAddress {
        /// The that rewards will be withdrawn to.
        address: String
    }
}

/// Iterator that iterates over all responses returned by
/// the various modules in **order of execution**.
pub struct Iter<'a> {
    responses: &'a [ResponseVariants],
    index: usize,
    stack: Vec<&'a ResponseVariants>
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

impl ResponseVariants {
    #[inline]
    pub fn is_instantiate(&self) -> bool {
        matches!(&self, Self::Instantiate(_))
    }

    #[inline]
    pub fn is_execute(&self) -> bool {
        matches!(&self, Self::Execute(_))
    }

    #[inline]
    pub fn is_reply(&self) -> bool {
        matches!(&self, Self::Reply(_))
    }

    #[inline]
    pub fn is_bank(&self) -> bool {
        matches!(&self, Self::Bank(_))
    }

    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn is_staking(&self) -> bool {
        matches!(&self, Self::Staking(_))
    }

    #[inline]
    #[cfg(feature = "ensemble-staking")]
    pub fn is_distribution(&self) -> bool {
        matches!(&self, Self::Distribution(_))
    }

    /// Returns the messages that were created by this response.
    /// Only instantiate, execute and reply can return a non-empty slice.
    #[inline]
    pub fn messages(&self) -> &[SubMsg] {
        match self {
            Self::Instantiate(resp) => &resp.response.messages,
            Self::Execute(resp) => &resp.response.messages,
            Self::Reply(resp) => &resp.response.messages,
            Self::Bank(_) => &[],
            #[cfg(feature = "ensemble-staking")]
            Self::Staking(_) => &[],
            #[cfg(feature = "ensemble-staking")]
            Self::Distribution(_) => &[]
        }
    }

    #[inline]
    pub(crate) fn add_responses(&mut self, responses: Vec<Self>) {
        match self {
            Self::Instantiate(resp) => resp.sent.extend(responses),
            Self::Execute(resp) => resp.sent.extend(responses),
            Self::Reply(resp) => resp.sent.extend(responses),
            Self::Bank(_) => panic!("Trying to add a child response to a BankResponse."),
            #[cfg(feature = "ensemble-staking")]
            Self::Staking(_) => panic!("Trying to add a child response to a StakingResponse."),
            #[cfg(feature = "ensemble-staking")]
            Self::Distribution(_) => panic!("Trying to add a child response to a DistributionResponse."),
        }
    }

    pub(crate) fn response(&self) -> Option<&Response> {
        match self {
            Self::Instantiate(resp) => Some(&resp.response),
            Self::Execute(resp) => Some(&resp.response),
            Self::Reply(resp) => Some(&resp.response),
            _ => None
        }
    }
}

impl From<InstantiateResponse> for ResponseVariants {
    #[inline]
    fn from(value: InstantiateResponse) -> Self {
        Self::Instantiate(value)
    }
}

impl From<ExecuteResponse> for ResponseVariants {
    #[inline]
    fn from(value: ExecuteResponse) -> Self {
        Self::Execute(value)
    }
}

impl From<ReplyResponse> for ResponseVariants {
    #[inline]
    fn from(value: ReplyResponse) -> Self {
        Self::Reply(value)
    }
}

impl From<BankResponse> for ResponseVariants {
    #[inline]
    fn from(value: BankResponse) -> Self {
        Self::Bank(value)
    }
}

#[cfg(feature = "ensemble-staking")]
impl From<StakingResponse> for ResponseVariants {
    #[inline]
    fn from(value: StakingResponse) -> Self {
        Self::Staking(value)
    }
}

#[cfg(feature = "ensemble-staking")]
impl From<DistributionResponse> for ResponseVariants {
    #[inline]
    fn from(value: DistributionResponse) -> Self {
        Self::Distribution(value)
    }
}

impl<'a> Iter<'a> {
    /// Yields all responses that were initiated by the given `sender`. Reply responses are not included.
    pub fn by_sender(self, sender: impl Into<String>) -> impl Iterator<Item = &'a ResponseVariants> {
        let sender = sender.into();

        self.filter(move |x| match x {
            ResponseVariants::Instantiate(resp) => resp.sender == sender,
            ResponseVariants::Execute(resp) => resp.sender == sender,
            ResponseVariants::Reply(_) => false,
            ResponseVariants::Bank(resp) => resp.sender == sender,
            #[cfg(feature = "ensemble-staking")]
            ResponseVariants::Staking(resp) => resp.sender == sender,
            #[cfg(feature = "ensemble-staking")]
            ResponseVariants::Distribution(resp) => resp.sender == sender,
        })
    }

    fn new(responses: &'a [ResponseVariants]) -> Self {
        Self {
            responses,
            index: 0,
            stack: vec![]
        }
    }

    fn enqueue_children(&mut self, node: &'a ResponseVariants) {
        match node {
            ResponseVariants::Execute(resp) =>
                self.stack.extend(resp.sent.iter().rev()),
            ResponseVariants::Reply(resp) =>
                self.stack.extend(resp.sent.iter().rev()),
            ResponseVariants::Instantiate(resp) =>
                self.stack.extend(resp.sent.iter().rev()),
            ResponseVariants::Bank(_) => { },
            #[cfg(feature = "ensemble-staking")]
            ResponseVariants::Staking(_) => { },
            #[cfg(feature = "ensemble-staking")]
            ResponseVariants::Distribution(_) => { }
        }
    }
}

impl<'a> Iterator for Iter<'a> {
    type Item = &'a ResponseVariants;

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

        if let ResponseVariants::Instantiate(inst) = &resp.sent[0] {
            assert_eq!(inst.sent.len(), 3);
            assert_eq!(iter.next().unwrap(), &inst.sent[0]);

            if let ResponseVariants::Instantiate(inst_2) = &inst.sent[0] {
                assert_eq!(inst_2.sent.len(), 2);
                assert_eq!(iter.next().unwrap(), &inst_2.sent[0]);
                assert_eq!(iter.next().unwrap(), &inst_2.sent[1]);

                if let ResponseVariants::Execute(exec) = &inst_2.sent[0] {
                    assert_eq!(exec.sender, "C");
                    assert_eq!(exec.address, "D");
                    assert_eq!(exec.sent.len(), 0);
                } else {
                    panic!()
                }

                if let ResponseVariants::Execute(exec) = &inst_2.sent[1] {
                    assert_eq!(exec.sender, "C");
                    assert_eq!(exec.address, "B");
                    assert_eq!(exec.sent.len(), 0);
                } else {
                    panic!()
                }
            } else {
                panic!()
            }

            assert_eq!(iter.next().unwrap(), &inst.sent[1]);
            if let ResponseVariants::Execute(exec) = &inst.sent[1] {
                assert_eq!(exec.sender, "B");
                assert_eq!(exec.address, "D");
                assert_eq!(exec.sent.len(), 0);
            } else {
                panic!()
            }

            assert_eq!(iter.next().unwrap(), &inst.sent[2]);
            if let ResponseVariants::Execute(exec) = &inst.sent[2] {
                assert_eq!(exec.sender, "B");
                assert_eq!(exec.address, "A");
                assert_eq!(exec.sent.len(), 0);
            } else {
                panic!()
            }
        } else {
            panic!()
        }

        assert_eq!(iter.next().unwrap(), &resp.sent[1]);
        if let ResponseVariants::Execute(exec) = &resp.sent[1] {
            assert_eq!(exec.sent.len(), 1);
            assert_eq!(iter.next().unwrap(), &exec.sent[0]);

            if let ResponseVariants::Bank(bank) = &exec.sent[0] {
                assert_eq!(bank.sender, "C");
                assert_eq!(bank.receiver, "B");
            } else {
                panic!()
            }
        } else {
            panic!()
        }

        assert_eq!(iter.next().unwrap(), &resp.sent[2]);
        if let ResponseVariants::Bank(bank) = &resp.sent[2] {
            assert_eq!(bank.sender, "A");
            assert_eq!(bank.receiver, "D");
        } else {
            panic!()
        }

        assert_eq!(iter.next(), None);
    }

    #[test]
    fn filter_by_sender() {
        let resp = mock_response();
        let mut iter = resp.iter().by_sender("B");

        if let ResponseVariants::Instantiate(inst) = &resp.sent[0] {
            assert_eq!(iter.next().unwrap(), &inst.sent[0]);
            assert_eq!(iter.next().unwrap(), &inst.sent[1]);
            assert_eq!(iter.next().unwrap(), &inst.sent[2]);
            assert_eq!(iter.next(), None);
        } else {
            panic!()
        }

        let mut iter = resp.iter().by_sender("C");

        if let ResponseVariants::Execute(exec) = iter.next().unwrap() {
            assert_eq!(exec.sender, "C");
            assert_eq!(exec.address, "D");
            assert_eq!(exec.msg, Binary::from(b"message_3"));
            assert_eq!(exec.sent.len(), 0);
        } else {
            panic!()
        }

        if let ResponseVariants::Execute(exec) = iter.next().unwrap() {
            assert_eq!(exec.sender, "C");
            assert_eq!(exec.address, "B");
            assert_eq!(exec.msg, Binary::from(b"message_4"));
            assert_eq!(exec.sent.len(), 0);
        } else {
            panic!()
        }

        if let ResponseVariants::Bank(bank) = iter.next().unwrap() {
            assert_eq!(bank.sender, "C");
            assert_eq!(bank.receiver, "B");
            assert_eq!(bank.coins[0].amount, Uint128::new(800));
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

    fn execute_resp(sender: impl Into<String>, address: impl Into<String>) -> ExecuteResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        let resp = ExecuteResponse {
            sender: sender.into(),
            address: address.into(),
            msg: Binary::from(format!("message_{}", index).as_bytes()),
            response: Response::default(),
            sent: vec![]
        };

        MSG_INDEX.with(|x| { *x.borrow_mut() += 1; });

        resp
    }

    fn instantiate_resp(sender: impl Into<String>) -> InstantiateResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        let resp = InstantiateResponse {
            sender: sender.into(),
            instance: ContractLink {
                address: Addr::unchecked(""),
                code_hash: String::new()
            },
            code_id: 0,
            msg: Binary::from(format!("message_{}", index).as_bytes()),
            response: Response::default(),
            sent: vec![]
        };

        MSG_INDEX.with(|x| { *x.borrow_mut() += 1; });

        resp
    }

    fn bank_resp(sender: impl Into<String>, to: impl Into<String>) -> BankResponse {
        let index = MSG_INDEX.with(|x| x.borrow().clone());

        BankResponse {
            sender: sender.into(),
            receiver: to.into(),
            coins: vec![Coin {
                denom: "uscrt".into(),
                amount: Uint128::new(100 * index as u128)
            }]
        }
    }
}

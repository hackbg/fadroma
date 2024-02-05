use fadroma::{
    cosmwasm_std::{SubMsg, ReplyOn, Event, Binary},
};
use crate::{
    ResponseVariants, EnsembleResult, SubMsgExecuteResult
};

pub struct ExecutionState {
    states: Vec<ExecutionLevel>,
    next: Option<MessageType>
}

pub enum MessageType {
    SubMsg {
        msg: SubMsg,
        sender: String
    },
    Reply {
        id: u64,
        error: Option<String>,
        target: String
    }
}

struct ExecutionLevel {
    data: Option<Binary>,
    responses: Vec<ResponseVariants>,
    msgs: Vec<SubMsgNode>,
    msg_index: usize
}

struct SubMsgNode {
    msg: SubMsg,
    state: SubMsgState,
    events: Vec<Event>
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum SubMsgState {
    NotExecuted,
    ShouldReply,
    Replying,
    Done
}

impl ExecutionState {
    #[inline]
    pub fn new(initial: SubMsg, sender: String) -> Self {
        assert_eq!(initial.reply_on, ReplyOn::Never);

        let mut level = ExecutionLevel::new(vec![initial.clone()]);
        level.current_mut().state = SubMsgState::Done;

        Self {
            states: vec![level],
            next: Some(MessageType::SubMsg {
                msg: initial,
                sender
            })
        }
    }

    pub fn process_result(
        &mut self,
        result: SubMsgExecuteResult
    ) -> EnsembleResult<usize> {
        match result {
            Ok((response, events)) => {

                if let Some(cw_resp) = response.response() {
                    // Replies will overwrite the caller data if they return Some.
                    if response.is_reply() && cw_resp.data.is_some() {
                        let index = self.states.len() - 2;
                        self.states[index].data = cw_resp.data.clone();
                    } else {
                        self.current_level_mut().data = cw_resp.data.clone();
                    }
                }

                let level = self.current_level_mut();
                level.current_mut().events.extend(events.take());

                let messages = response.messages().to_vec();
                level.responses.push(response);
        
                if messages.len() > 0 {
                    self.states.push(ExecutionLevel::new(messages));
                }

                self.find_next(
                    None,
                    |reply_on| matches!(reply_on, ReplyOn::Always | ReplyOn::Success)
                );

                Ok(0)
            },
            Err(err) if err.is_contract_error() => {
                let revert_count = self.find_next(
                    Some(err.to_string()),
                    |reply_on| matches!(reply_on, ReplyOn::Always | ReplyOn::Error)
                );

                if self.next.is_none() {
                    // If a contract returned an error but no caller
                    // could "catch" it, the entire TX should be reverted.
                    Err(err)
                } else {
                    // +1 because we have to revert the current scope as well
                    Ok(revert_count + 1)
                }
            },
            Err(err) => Err(err)
        }
    }

    #[inline]
    pub fn next(&mut self) -> Option<MessageType> {
        self.next.take()
    }

    #[inline]
    pub fn events(&self) -> &[Event] {
        &self.current_level().current().events
    }

    #[inline]
    pub fn data(&mut self) -> Option<&Binary> {
        self.current_level_mut().data.as_ref()
    }

    pub fn finalize(mut self) -> ResponseVariants {
        assert!(self.states.len() == 1 && self.next.is_none());
        assert_eq!(self.states[0].responses.len(), 1);

        self.states[0].responses.pop().unwrap()
    }

    fn current_sender(&self) -> String {
        let index = self.states.len() - 2;

        contract_address(
            self.states[index].responses.last().unwrap()
        ).to_string()        
    }

    fn find_next<F>(&mut self, error: Option<String>, test: F) -> usize
       where F: Fn(&ReplyOn) -> bool
    {
        assert!(self.next.is_none());

        let start_index = self.states.len() - 1;
        let mut responses_thrown = 0;

        loop {
            if self.states.is_empty() {
                break;
            }

            let index = self.states.len() - 1;

            match self.states[index].current().state {
                SubMsgState::NotExecuted => {
                    let state = &mut self.states[index];
                    let current = state.current_mut();

                    current.state = if current.msg.reply_on == ReplyOn::Never {
                        SubMsgState::Done
                    } else {
                        SubMsgState::ShouldReply
                    };
                    
                    self.next = Some(MessageType::SubMsg {
                        msg: current.msg.clone(),
                        sender: self.current_sender()
                    });

                    break;
                },
                SubMsgState::Done => {
                    if error.is_some() {
                        responses_thrown += self.pop().responses.len();
                    } else {
                        let state = &mut self.states[index];
                        state.next();
    
                        // If we don't have a next node and we are currently
                        // at the root then we are finished.
                        if !state.has_next() && !self.squash_latest() {
                            break;
                        }
                    }
                }
                SubMsgState::ShouldReply => {
                    let reply = self.find_reply(error.clone(), &test);

                    if error.is_some() {
                        if reply.is_some() {
                            // We only do this if we have already recursed up
                            // (i.e this is not the first iteration of the loop) otherwise,
                            // the response wasn't added to begin with since we have an error.
                            if index != start_index {
                                let state = &mut self.states[index];
                                state.responses.pop();
    
                                responses_thrown += 1;
                            }
                        } else {
                            responses_thrown += self.pop().responses.len();

                            continue;
                        }
                    }

                    self.next = reply;
                    self.states[index].current_mut().state = SubMsgState::Replying;

                    break;
                }
                SubMsgState::Replying => {
                    if error.is_some() {
                        responses_thrown += self.pop().responses.len();
                    } else {
                        self.states[index].current_mut().state = SubMsgState::Done;
                    }
                }
            }
        }

        responses_thrown
    }

    fn find_reply<F>(
        &self,
        error: Option<String>,
        test: &F
    ) -> Option<MessageType>
        where F: Fn(&ReplyOn) -> bool
    {
        if self.states.len() < 2 {
            return None;
        }

        let current = self.current_level().current();

        if test(&current.msg.reply_on) {
            let index = self.states.len() - 2;
            let target = contract_address(
                self.states[index].responses.last().unwrap()
            ).to_string();

            let reply = MessageType::Reply {
                id: current.msg.id,
                error,
                target
            };

            Some(reply)
        } else {
            None
        }
    }

    fn squash_latest(&mut self) -> bool {
        if self.states.len() <= 1 {
            return false;
        }

        let latest = self.pop();
        let level = self.current_level_mut();

        level.responses.last_mut().unwrap()
            .add_responses(latest.responses);

        let len = latest.msgs.iter().map(|x| x.events.len()).sum();
        let mut events = Vec::with_capacity(len);

        for x in latest.msgs {
            events.extend(x.events);
        }

        level.current_mut().events.extend(events);

        true
    }

    #[inline]
    fn current_level_mut(&mut self) -> &mut ExecutionLevel {
        self.states.last_mut().unwrap()
    }

    #[inline]
    fn current_level(&self) -> &ExecutionLevel {
        self.states.last().unwrap()
    }

    #[inline]
    fn pop(&mut self) -> ExecutionLevel {
        self.states.pop().unwrap()
    }
}

impl ExecutionLevel {
    fn new(msgs: Vec<SubMsg>) -> Self {
        assert!(!msgs.is_empty());

        Self {
            data: None,
            responses: Vec::with_capacity(msgs.len()),
            msg_index: 0,
            msgs: msgs.into_iter().map(|x| SubMsgNode::new(x)).collect()
        }
    }

    #[inline]
    fn current(&self) -> &SubMsgNode {
        &self.msgs[self.msg_index]
    }

    #[inline]
    fn current_mut(&mut self) -> &mut SubMsgNode {
        &mut self.msgs[self.msg_index]
    }

    #[inline]
    fn next(&mut self) {
        assert_eq!(self.current().state, SubMsgState::Done);
        self.msg_index += 1;
    }

    #[inline]
    fn has_next(&self) -> bool {
        if self.msg_index < self.msgs.len() {
            true
        } else {
            false
        }
    }
}

impl SubMsgNode {
    #[inline]
    fn new(msg: SubMsg) -> Self {
        Self {
            msg,
            state: SubMsgState::NotExecuted,
            events: vec![]
        }
    }
}

#[inline]
fn contract_address(resp: &ResponseVariants) -> &str {
    match resp {
        ResponseVariants::Instantiate(resp) => resp.instance.address.as_str(),
        ResponseVariants::Execute(resp) => &resp.address,
        ResponseVariants::Reply(resp) => &resp.address,
        ResponseVariants::Bank(_) => unreachable!(),
        #[cfg(feature = "ensemble-staking")]
        ResponseVariants::Staking(_) => unreachable!(),
        #[cfg(feature = "ensemble-staking")]
        ResponseVariants::Distribution(_) => unreachable!()
    }
}

use crate::{cosmwasm_std::*, ensemble::{*, event::*}};

/// An execution stack, keeping track of messages and replies.
#[derive(Debug)]
pub(crate) struct Stack {
    /// Execution slot: contains next message to execute.
    next: Option<NextMessage>,
    /// State frames in the stack.
    pub(crate) frames: Vec<Frame>,
}

#[derive(Debug)]
pub enum NextMessage {
    SubMsg { msg: SubMsg, sender: String },
    Reply { id: u64, error: Option<String>, target: String }
}

impl Stack {
    /// Create a new execution stack from a single message.
    /// As a result of executing this message, more replies
    /// and messages may be recursively appended to the stack.
    /// (Called at beginning of `Context::execute_messages`.)
    #[inline]
    pub fn new(msg: SubMsg, sender: String) -> Self {
        // The initial message is passed from outside, therefore
        // it may not have a `reply_on` value other than `Never`.
        assert_eq!(msg.reply_on, ReplyOn::Never);
        // Create a new instance of `Stack` with a single state frame,
        // and the initial message in the execution slot.
        let frames = vec![Frame::new_done(&msg)];
        let next = Some(NextMessage::SubMsg { msg, sender });
        Self { next, frames }
        // From here, `Context::execute_messages` will repeatedly:
        // - pass the `next` message to the corresponding contract,
        // - call `Stack::process_result` w/the result from the contract.
        // The latter may add new `frames` and set `next` to a new value;
        // if it doesn't, that means execution is over.
    }
    /// Return the next message in this stack, if present,
    /// resetting `self.next` to `None`.
    #[inline]
    pub fn take_next(&mut self) -> Option<NextMessage> {
        self.next.take()
    }
    /// Process the next result. (Called from `Context::execute_messages`
    /// as long as `Stack::next()` returns new replies or messages for
    /// the contract to execute.) Return the number of frames to revert.
    pub fn process_result(&mut self, result: SubMsgExecuteResult) -> EnsembleResult<usize> {
        super::display::print_sub_msg_execute_result(&self, &result);
        match result {
            Ok((response, events)) =>
                self.on_success(response, events),
            Err(err) if err.is_contract_error() =>
                self.on_error(err),
            Err(err) =>
                Err(err)
        }
    }
    /// Assert that this stack is fully executed, and that
    /// there exists exactly one final response. Return that response.
    pub fn finalize(mut self) -> ResponseVariants {
        assert!(self.frames.len() == 1 && self.next.is_none());
        assert_eq!(self.frames[0].responses.len(), 1);
        //super::display::print_finalized_execution_state(&self);
        self.frames[0].responses.pop().unwrap()
    }
    /// If contract execution succeeded:
    /// - 0 frames need to be reverted
    /// - New frames may be added to the stack
    fn on_success (&mut self, response: ResponseVariants, events: ProcessedEvents)
        -> EnsembleResult<usize>
    {
        println!("Response: {response:#?}\nEvents: {events:#?}");
        // Replies will overwrite the caller data if they return Some.
        if let Some(contract_response) = response.response() {
            if response.is_reply() && contract_response.data.is_some() {
                // If this is a reply, add the data to the caller frame.
                let index = self.frames.len() - 2;
                self.frames[index].data = contract_response.data.clone();
            } else {
                // Otherwise add it to the current frame.
                self.current_frame_mut().data = contract_response.data.clone();
            }
        }
        // Update current frame, adding results from contract call:
        let frame = self.current_frame_mut();
        // - Add the events from the contract to the current frame's events.
        frame.current_msg_mut().events.extend(events.take());
        let messages = response.messages().to_vec();
        println!("Frame: {frame:#?}\nMessages: {messages:#?}");
        // - Add the response from the contract to the current frame's responses.
        frame.responses.push(response);
        // - If the contract response contains any messages,
        //   add them to the stack as a new frame.
        if messages.len() > 0 {
            self.frames.push(Frame::new(messages));
        }
        // Find the next message to execute.
        self.update_next(None, |r| matches!(r, ReplyOn::Always | ReplyOn::Success));
        Ok(0)
    }
    /// If contract returned error:
    /// - If there is no next message, the error is returned.
    /// - If there is a next message, the number of states to revert is returned,
    ///   and the caller contract is allowed to handle the error.
    fn on_error (&mut self, err: EnsembleError) -> EnsembleResult<usize> {
        let to_revert = self.update_next(Some(err.to_string()),
            |r| matches!(r, ReplyOn::Always | ReplyOn::Error));
        if self.next.is_none() {
            // If a contract returned an error but no caller
            // could "catch" it, the entire TX should be reverted.
            Err(err)
        } else {
            // +1 because we have to revert the current scope as well
            Ok(to_revert + 1)
        }
    }
    /// Find the next message to execute according to the given predicate,
    /// set it in `self.next`, and return the number of frames to revert
    /// (minus one, which is added by `Stack::on_error`).
    fn update_next<F: Fn(&ReplyOn) -> bool>(&mut self, error: Option<String>, test: F) -> usize {
        assert!(self.next.is_none());
        let start_index = self.frames.len() - 1;
        let mut to_revert = 0;
        loop {
            if self.frames.is_empty() {
                break;
            }
            let index = self.frames.len() - 1;
            match self.frames[index].current_msg().state {
                SubMsgState::NotExecuted => {
                    let frame = &mut self.frames[index];
                    let current = frame.current_msg_mut();
                    current.state = if current.msg.reply_on == ReplyOn::Never {
                        SubMsgState::Done
                    } else {
                        SubMsgState::ShouldReply
                    };
                    self.next = Some(NextMessage::SubMsg {
                        msg: current.msg.clone(),
                        sender: self.current_sender()
                    });
                    break;
                },
                SubMsgState::Done => {
                    if error.is_some() {
                        to_revert += self.pop().responses.len();
                    } else {
                        let frame = &mut self.frames[index];
                        frame.next_msg();
                        // If we don't have a next node and we are currently
                        // at the root then we are finished.
                        if !frame.has_next_msg() && !self.squash_latest() {
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
                                let state = &mut self.frames[index];
                                state.responses.pop();
                                to_revert += 1;
                            }
                        } else {
                            to_revert += self.pop().responses.len();

                            continue;
                        }
                    }
                    self.next = reply;
                    self.frames[index].current_msg_mut().state = SubMsgState::Replying;
                    break;
                }
                SubMsgState::Replying => {
                    if error.is_some() {
                        to_revert += self.pop().responses.len();
                    } else {
                        self.frames[index].current_msg_mut().state = SubMsgState::Done;
                    }
                }
            }
        }
        to_revert
    }

    #[inline]
    pub fn events(&self) -> &[Event] {
        &self.current_frame().current_msg().events
    }

    #[inline]
    pub fn data(&mut self) -> Option<&Binary> {
        self.current_frame_mut().data.as_ref()
    }

    /// Return the address of the message sender for the current frame.
    /// Where does the magic number 2 come from?
    fn current_sender(&self) -> String {
        contract_address(self.frames[self.frames.len() - 2].responses.last().unwrap()).to_string()
    }

    fn find_reply<F>(&self, error: Option<String>, test: &F) -> Option<NextMessage>
        where F: Fn(&ReplyOn) -> bool
    {
        if self.frames.len() < 2 {
            None
        } else {
            let current = self.current_frame().current_msg();
            if test(&current.msg.reply_on) {
                let index = self.frames.len() - 2;
                let target = contract_address(self.frames[index].responses.last().unwrap());
                Some(NextMessage::Reply { id: current.msg.id, error, target: target.to_string() })
            } else {
                None
            }
        }
    }

    fn squash_latest(&mut self) -> bool {
        if self.frames.len() <= 1 {
            false
        } else {
            let latest = self.pop();
            let frame = self.current_frame_mut();
            frame.responses.last_mut().unwrap().add_responses(latest.responses);
            let len = latest.msgs.iter().map(|x| x.events.len()).sum();
            let mut events = Vec::with_capacity(len);
            for x in latest.msgs {
                events.extend(x.events);
            }
            frame.current_msg_mut().events.extend(events);
            true
        }
    }

    #[inline]
    fn current_frame_mut(&mut self) -> &mut Frame {
        self.frames.last_mut().unwrap()
    }

    #[inline]
    fn current_frame(&self) -> &Frame {
        self.frames.last().unwrap()
    }

    #[inline]
    fn pop(&mut self) -> Frame {
        self.frames.pop().unwrap()
    }
}

#[derive(Debug)]
pub(crate) struct Frame {
    pub(crate) data:      Option<Binary>,
    pub(crate) responses: Vec<ResponseVariants>,
    pub(crate) msgs:      Vec<SubMsgNode>,
    pub(crate) msg_index: usize
}

impl Frame {
    fn new(msgs: Vec<SubMsg>) -> Self {
        assert!(!msgs.is_empty());
        Self {
            data: None,
            responses: Vec::with_capacity(msgs.len()),
            msg_index: 0,
            msgs: msgs.into_iter().map(|x| SubMsgNode::new(x)).collect()
        }
    }

    fn new_done(msg: &SubMsg) -> Self {
        let mut frame = Self::new(vec![msg.clone()]);
        frame.current_msg_mut().state = SubMsgState::Done;
        frame
    }

    #[inline]
    fn current_msg(&self) -> &SubMsgNode {
        &self.msgs[self.msg_index]
    }

    #[inline]
    fn current_msg_mut(&mut self) -> &mut SubMsgNode {
        &mut self.msgs[self.msg_index]
    }

    #[inline]
    fn next_msg(&mut self) {
        assert_eq!(self.current_msg().state, SubMsgState::Done);
        self.msg_index += 1;
    }

    #[inline]
    fn has_next_msg(&self) -> bool {
        self.msg_index < self.msgs.len()
    }
}

#[derive(Debug)]
pub(crate) struct SubMsgNode {
    pub(crate) msg:    SubMsg,
    pub(crate) state:  SubMsgState,
    pub(crate) events: Vec<Event>
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub(crate) enum SubMsgState {
    NotExecuted,
    ShouldReply,
    Replying,
    Done
}

impl SubMsgNode {
    #[inline]
    fn new(msg: SubMsg) -> Self {
        Self { msg, state: SubMsgState::NotExecuted, events: vec![] }
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

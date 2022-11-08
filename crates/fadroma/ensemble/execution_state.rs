use crate::{
    cosmwasm_std::{SubMsg, ReplyOn},
    ensemble::{
        ResponseVariants, EnsembleResult
    }
};

pub struct ExecutionState {
    states: Vec<ExecutionLevel>,
    next: Option<MessageType>,
    /// The `this.states` index at which the current reply is being executed.
    reply_level: Option<usize>
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
    responses: Vec<ResponseVariants>,
    msgs: Vec<SubMsgNode>,
    msg_index: usize
}

struct SubMsgNode {
    msg: SubMsg,
    state: SubMsgState
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum SubMsgState {
    NotExecuted,
    Replying,
    Done
}

impl ExecutionState {
    #[inline]
    pub fn new(initial: SubMsg, sender: String) -> Self {
        assert_eq!(initial.reply_on, ReplyOn::Never);

        let mut level = ExecutionLevel::new(vec![initial.clone()]);
        level.current_mut().state = SubMsgState::Done;

        let instance = Self {
            states: vec![level],
            next: Some(MessageType::SubMsg {
                msg: initial,
                sender
            }),
            reply_level: None
        };

        instance
    }

    pub fn process_result(
        &mut self,
        result: EnsembleResult<ResponseVariants>
    ) -> EnsembleResult<usize> {
        match result {
            Ok(response) => {
                self.add_response(response);

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

    pub fn finalize(mut self) -> ResponseVariants {
        assert!(self.states.len() > 0);

        while self.squash_latest() { }
        assert_eq!(self.states[0].responses.len(), 1);

        self.states[0].responses.pop().unwrap()
    }

    fn add_response(&mut self, response: ResponseVariants) {
        let messages = response.messages().to_vec();

        let index = self.states.len() - 1;
        self.states[index].responses.push(response);

        if messages.len() > 0 {
            self.states.push(ExecutionLevel::new(messages));
        }
    }

    fn current_sender(&self) -> String {
        let index = self.states.len() - 2;

        self.states[index]
            .responses
            .last()
            .unwrap()
            .address()
            .into()
    }

    fn find_next<F>(&mut self, error: Option<String>, test: F) -> usize
        where F: Fn(&ReplyOn) -> bool
    {
        assert!(self.next.is_none());

        if self.states.is_empty() {
            return 0;
        }

        let mut responses_thrown = 0;

        // This handles the case where the "reply" call itself returned an error.
        if let Some(index) = self.reply_level.take() {
            if error.is_some() {
                while self.states.len() - 1 > index {
                    responses_thrown += self.pop().responses.len();
                }
            }
        }

        loop {
            if self.states.is_empty() {
                break;
            }

            let index = self.states.len() - 1;

            match self.states[index].current().state {
                SubMsgState::Done => {
                    if error.is_some() {
                        let reply = self.find_reply(error.clone(), &test);
                        let state = &mut self.states[index];

                        if let Some((reply_level, reply)) = reply {
                            state.responses.pop();
                            responses_thrown += 1;

                            // We have to advance to the next message so we can't break
                            // here - we do that below. If we don't move to the next messsage,
                            // the next call to this function will run the same reply again.
                            self.next = Some(reply);
                            self.reply_level = Some(reply_level);
                        } else {
                            // We don't advance to the next message because the entire
                            // sub-message level is reverted here and thus we need to
                            // "restart" the loop from the parent level.
                            responses_thrown += self.pop().responses.len();

                            continue;
                        }
                    }

                    let state = &mut self.states[index];
                    state.next();

                    if !state.has_next() && !self.squash_latest() {
                        break;
                    }

                    if self.next.is_some() {
                        break;
                    }
                },
                SubMsgState::NotExecuted => {
                    let state = &mut self.states[index];
                    let current = state.current_mut();

                    current.state = if current.msg.reply_on == ReplyOn::Never {
                        SubMsgState::Done
                    } else {
                        SubMsgState::Replying
                    };
                    
                    self.next = Some(MessageType::SubMsg {
                        msg: current.msg.clone(),
                        sender: self.current_sender()
                    });

                    break;
                },
                SubMsgState::Replying => {
                    let state = &mut self.states[index];

                    state.current_mut().state = SubMsgState::Done;
                    let reply = self.find_reply(error.clone(), &test);

                    if let Some((reply_level, reply)) = reply {
                        self.next = Some(reply);
                        self.reply_level = Some(reply_level);

                        break;
                    }
                }
            }
        }

        responses_thrown
    }

    /// Returns the state level at which the reply will be called and
    /// the reply message itself.
    fn find_reply<F>(
        &self,
        error: Option<String>,
        test: &F
    ) -> Option<(usize, MessageType)>
        where F: Fn(&ReplyOn) -> bool
    {
        assert!(!self.states.is_empty());
        let mut index = self.states.len() - 1;

        loop {
            let state = &self.states[index];
            let current = state.current();

            if test(&current.msg.reply_on) {
                let reply_level = index - 1;
                let target = self.states[reply_level]
                    .responses
                    .last()
                    .unwrap()
                    .address()
                    .to_string();

                let reply = MessageType::Reply {
                    id: current.msg.id,
                    error,
                    target
                };

                return Some((reply_level, reply));
            }

            if state.has_next() || index <= 1 {
                return None;
            }

            index -= 1;
        }
    }

    fn squash_latest(&mut self) -> bool {
        if self.states.len() <= 1 {
            return false;
        }

        let current = self.pop();
        let index = self.states.len() - 1;
        
        self.states[index].responses
            .last_mut()
            .unwrap()
            .add_responses(current.responses);

        true
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
        Self { msg, state: SubMsgState::NotExecuted }
    }
}

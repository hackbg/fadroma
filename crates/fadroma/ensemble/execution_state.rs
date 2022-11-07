use crate::{
    cosmwasm_std::{SubMsg, ReplyOn},
    ensemble::{
        ResponseVariants, EnsembleResult
    }
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
            })
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
                todo!()
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

    fn find_next<F>(&mut self, error: Option<String>, test: F)
        where F: Fn(&ReplyOn) -> bool
    {
        assert!(self.next.is_none());

        if self.states.is_empty() {
            return;
        }

        loop {
            let index = self.states.len() - 1;
            let state = &mut self.states[index];

            match state.current().state {
                SubMsgState::Done => {
                    state.next();

                    if !state.has_next() && !self.squash_latest() {
                        break;
                    }
                },
                SubMsgState::NotExecuted => {
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
                    state.current_mut().state = SubMsgState::Done;
                    let reply = self.find_reply(error.clone(), &test);

                    if reply.is_some() {
                        self.next = reply;

                        break;
                    }
                }
            }
        }
    }

    fn find_reply<F>(&self, error: Option<String>, test: &F) -> Option<MessageType>
        where F: Fn(&ReplyOn) -> bool
    {
        assert!(!self.states.is_empty());
        let mut index = self.states.len() - 1;

        loop {
            let state = &self.states[index];
            let current = state.current();

            if test(&current.msg.reply_on) {
                let target = self.states[index - 1]
                    .responses
                    .last()
                    .unwrap()
                    .address()
                    .to_string();

                return Some(MessageType::Reply {
                    id: current.msg.id,
                    error,
                    target
                });
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

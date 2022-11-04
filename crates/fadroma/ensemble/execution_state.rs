use crate::{
    cosmwasm_std::{SubMsg, ReplyOn},
    ensemble::{
        ResponseVariants, EnsembleResult
    }
};

pub struct ExecutionState {
    states: Vec<ExecutionLevel>,
    next: Option<MessageType>,
    initial_sender: Option<String>,
    replied: bool
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
    msgs: Vec<SubMsg>,
    msg_index: usize
}

impl ExecutionState {
    #[inline]
    pub fn new(initial: SubMsg, sender: String) -> Self {
        Self {
            states: vec![ExecutionLevel::new(vec![initial])],
            initial_sender: Some(sender),
            next: None,
            replied: false
        }
    }

    pub fn process_result(
        &mut self,
        result: EnsembleResult<ResponseVariants>
    ) -> EnsembleResult<usize> {
        match result {
            Ok(response) => {
                let should_reply = !self.add_response(response);

                if should_reply && !self.replied {
                    let reply = self.find_reply(
                        None,
                        |reply_on| matches!(reply_on, ReplyOn::Always | ReplyOn::Success)
                    );

                    if reply.is_some() {
                        self.next = reply;
                        self.replied = true;

                        return Ok(0);
                    }
                }

                self.replied = false;

                if let Some(msg) = self.find_next() {
                    let sender = self.current_sender();

                    self.next = Some(MessageType::SubMsg {
                        msg,
                        sender
                    })
                }

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
        if let Some(sender) = self.initial_sender.take() {
            Some(MessageType::SubMsg {
                msg: self.states[0].next().unwrap(),
                sender
            })
        } else {
            self.next.take()
        }
    }

    pub fn finalize(mut self) -> ResponseVariants {
        assert!(self.states.len() > 0);

        while self.squash_latest() { }
        assert_eq!(self.states[0].responses.len(), 1);

        self.states[0].responses.pop().unwrap()
    }

    /// Returns `true` if a new `ExecutionLevel` was pushed onto the stack.
    fn add_response(&mut self, response: ResponseVariants) -> bool {
        let messages = response.messages().to_vec();

        let index = self.states.len() - 1;
        self.states[index].responses.push(response);

        if messages.len() > 0 {
            self.states.push(ExecutionLevel::new(messages));

            true
        } else {
            false
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

    fn find_reply<F>(&self, error: Option<String>, test: F) -> Option<MessageType>
        where F: Fn(&ReplyOn) -> bool
    {
        assert!(!self.states.is_empty());
        let mut index = self.states.len() - 1;

        loop {
            let state = &self.states[index];

            if test(&state.current().reply_on) {
                let target = self.states[index - 1]
                    .responses
                    .last()
                    .unwrap()
                    .address()
                    .to_string();

                return Some(MessageType::Reply {
                    id: state.current().id,
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

    fn find_next(&mut self) -> Option<SubMsg> {
        if self.states.is_empty() {
            return None;
        }

        loop {
            let index = self.states.len() - 1;
            let state = &mut self.states[index];

            let next = state.next();

            if next.is_some() {
                return next;
            } else {
                if !self.squash_latest() {
                    break;
                }
            }
        }

        None
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
            msgs
        }
    }

    #[inline]
    fn current(&self) -> &SubMsg {
        if self.msg_index > 0 {
            &self.msgs[self.msg_index - 1]
        } else {
            &self.msgs[0]
        }
    }

    #[inline]
    fn next(&mut self) -> Option<SubMsg> {
        if self.msg_index < self.msgs.len() {
            let msg = self.msgs[self.msg_index].clone();
            self.msg_index += 1;

            Some(msg)
        } else {
            None
        }
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

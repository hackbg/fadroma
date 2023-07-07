#![allow(unused)]

use super::*;
use crate::{prelude::*, ensemble::{event::ProcessedEvents, execution_state::*}};
use std::fmt::{Display, Debug, Formatter, Result};
use indent::indent_all_by;

const TAB: usize = 2;

fn format_option <T, F: Fn(&T)->String> (title: &str, input: &Option<T>, format: F) -> String {
    let (tab, title) = if title.len() > 0 {
        (TAB, format!("{title}\n"))
    } else {
        (0usize, String::new())
    };
    if let Some(input) = input {
        indent_all_by(tab, format!("{title}{}\n", indent_all_by(tab, format(input))))
    } else {
        String::new()
    }
}

fn format_list <T, F: Fn(&T)->String> (title: &str, input: &Vec<T>, format: F) -> String {
    let mut output = vec![];
    for item in input.iter() {
        output.push(format(item));
    }
    if output.len() > 0 {
        indent_all_by(TAB, format!("\n{title}\n{}", indent_all_by(TAB, output.join("\n"))))
    } else {
        String::new()
    }
}

impl Display for ExecuteResponse {
    fn fmt(&self, f: &mut Formatter) -> Result {
        let Self { sender, address, response, msg, sent } = self;
        let Response { messages, attributes, events, data, .. } = response;
        let msgs = format_list("Response messages:", &messages,
            |s: &SubMsg|   format!("{}: {:?}", s.id, s.msg));
        let attrs = format_list("Response attributes:", &attributes,
            |a: &Attribute|format!("{} = {}", a.key, a.value));
        let evts = format_list("Response events:", &events,
            |e: &Event|format!("{e:?}"));
        let sent = format_list("Sent messages:", &sent,
            |m: &ResponseVariants|format!("{m}"));
        let data = format_option("Response data:", &data,
            |d: &Binary|format!("{d:?}"));
        let msg = indent_all_by(4, String::from_utf8(msg.0.clone()).unwrap());
        write!(f, "ExecuteResponse ({sender} <- {address})\n  \
            Message:\n{msg}{msgs}{attrs}{evts}{data}{sent}")

    }
}

impl Display for ResponseVariants {
    fn fmt (&self, f: &mut Formatter) -> Result {
        match self {
            Self::Instantiate(resp) => write!(f,
                "Instantiate ({} <- {})", resp.sender, resp.instance.address),
            Self::Execute(resp) => write!(f,
                "Execute ({} <- {})", resp.sender, resp.address),
            Self::Reply(resp) => write!(f,
                "Reply #{} ({} <-)", resp.reply.id, resp.address),
            Self::Bank(resp) =>
                Debug::fmt(resp, f),
            #[cfg(feature = "ensemble-staking")]
            Self::Staking(resp) =>
                Debug::fmt(resp, f),
            #[cfg(feature = "ensemble-staking")]
            Self::Distribution(resp) =>
                Debug::fmt(resp, f),
        }
    }
}

impl Display for ProcessedEvents {
    fn fmt (&self, f: &mut Formatter) -> Result {
        write!(f, "{}", format_list("Events:", &self.0,
            |event: &Event| format_list(&event.ty, &event.attributes,
                |attr: &Attribute| format!("{} = {}", attr.key, attr.value))))
    }
}

impl Display for Frame {
    fn fmt (&self, f: &mut Formatter) -> Result {
        let messages = format_list("Messages:", &self.msgs,
            |m: &SubMsgNode|format!("{m}"));
        let responses = format_list("Responses:", &self.responses,
            |r: &ResponseVariants|format!("{r}"));
        let data = format_option("Data:", &self.data,
            |d: &Binary|format!("{d:?}"));
        let index = self.msg_index;
        write!(f, "Frame (index={index}):{data}  {messages}{responses}")
    }
}

impl Display for SubMsgNode {
    fn fmt (&self, f: &mut Formatter) -> Result {
        let events = format_list("Events:", &self.events,
            |e: &Event| format_list(&e.ty, &e.attributes,
                |a: &Attribute| format!("{} = {}", a.key, a.value)));
        let state = self.state;
        let SubMsg { id, msg, gas_limit, reply_on } = &self.msg;
        write!(f, "\n  Message (state={state:?} reply_on={reply_on:?}):\n    {msg:?}\n{events}")
    }
}

#[allow(dead_code)]
pub(crate) fn print_sub_msg_execute_result (state: &Stack, result: &SubMsgExecuteResult) {
    println!("{}", match result {
        Ok((response, events)) => {
            let frames = state.frames.len();
            let response = indent::indent_all_by(2, format!("{response}"));
            format!("\n[depth={frames}]{response}{events}")
        },
        Err(err) => {
            format!("ERR (reverting): {err}")
        }
    })
}

#[allow(dead_code)]
pub(crate) fn print_finalized_execution_state (state: &Stack) {
    let frames = format_list("Frames:", &state.frames,
        |frame: &Frame|format!("- {frame}"));
    println!("\nOK: Finalized execution state:{frames}");
}

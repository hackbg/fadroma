use super::*;
use crate::{prelude::*, ensemble::{event::ProcessedEvents, execution_state::ExecutionState}};
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
        indent_all_by(TAB, format!("{title}\n{}\n", indent_all_by(TAB, output.join("\n"))))
    } else {
        String::new()
    }
}

impl Display for ExecuteResponse {
    fn fmt(&self, f: &mut Formatter) -> Result {
        let Self { sender, address, response, msg, sent } = self;
        let msgs = format_list("Response messages:", &response.messages,
            |sub: &SubMsg|format!("{}: {:?}", sub.id, sub.msg));
        let attrs = format_list("Response attributes:", &response.attributes,
            |attr: &Attribute|format!("{} = {}", attr.key, attr.value));
        let evts = format_list("Response events:", &response.events,
            |event: &Event|format!("{event:?}"));
        let sent = format_list("Sent messages:", &sent,
            |msg: &ResponseVariants|format!("{msg}"));
        let data = format_option("Response data:", &response.data,
            |data: &Binary|format!("{data:?}"));
        let msg = indent_all_by(4, String::from_utf8(msg.0.clone()).unwrap());
        write!(f, "ExecuteResponse ({sender} <- {address})\n  \
            Message:\n{msg}\n{msgs}{attrs}{evts}{data}{sent}")

    }
}

impl Display for ResponseVariants {
    fn fmt (&self, f: &mut Formatter) -> Result {
        match self {
            Self::Instantiate(resp) => write!(f,
                "Instantiate ({} <- {})", resp.sender, resp.instance.address),
            Self::Execute(resp) => write!(f,
                "Execute     ({} <- {})", resp.sender, resp.address),
            Self::Reply(resp) => write!(f,
                "Reply #{}    ({} <-)", resp.reply.id, resp.address),
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
        write!(f, "{}", format_list("Processed events:", &self.0, |event: &Event|
            format_list(&event.ty, &event.attributes, |attr: &Attribute|
                format!("{} = {}", attr.key, attr.value))))
    }
}

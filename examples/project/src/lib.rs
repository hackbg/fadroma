//! Created by @fadroma/project 1.0.0, courtesy of [Hack.bg](https://hack.bg). See [https://fadroma.tech](https://fadroma.tech).

pub(crate) use fadroma::prelude::*;

#[cfg(feature = "name")]
pub mod name;

#[cfg(feature = "contracts")]
pub mod contracts;

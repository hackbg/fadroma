use syn::{Attribute, Meta, NestedMeta, MetaList, Ident, parse_quote};
use proc_macro2::Span;

use crate::err::ErrorSink;

/// Name of the auto-generated struct that represents a contract or a module.
pub const CONTRACT: &str = "Contract";

pub const INIT_MSG: &str = "InstantiateMsg";
pub const EXECUTE_MSG: &str = "ExecuteMsg";
pub const QUERY_MSG: &str = "QueryMsg";

pub const INIT_FN: &str = "instantiate";
pub const EXECUTE_FN: &str = "execute";
pub const QUERY_FN: &str = "query";

/// Name of the associated type that represents the error type in an interface.
pub const ERROR_TYPE_IDENT: &str = "Error";
/// Used as a meta tag in the `#[init(entry)]` attribute.
pub const ENTRY_META: &str = "entry";

#[derive(Clone, Copy, Debug)]
pub enum MsgAttr {
    Init { entry: bool },
    Execute,
    Query
}

impl MsgAttr {
    pub const ALL: [&'static str; 3] = [
        Self::INIT,
        Self::EXECUTE,
        Self::QUERY
    ];

    const INIT: &str = "init";
    const EXECUTE: &str = "execute";
    const QUERY: &str = "query";

    pub fn parse(sink: &mut ErrorSink, attrs: &[Attribute]) -> Option<Self> {
        for attr in attrs {
            if let Some(ident) = attr.path.get_ident() {
                let instance = match ident.to_string().as_str() {
                    Self::INIT => {
                        let meta = match attr.parse_meta() {
                            Ok(meta) => meta,
                            Err(err) => {
                                sink.push_err(err);
                                return None;
                            }
                        };

                        let mut entry = false;

                        let ok = match meta {
                            Meta::List(list) => {
                                entry = validate_entry_meta(&list);

                                entry
                            },
                            // This matches when there is no nested meta. The first
                            // segment will always be the "init" identifier which we
                            // already verified.
                            Meta::Path(path) if path.segments.len() == 1 => true,
                            _ => false
                        };

                        if !ok {
                            sink.push_spanned(&attr, "Unexpected meta.");
                        }

                        Some(Self::Init { entry })
                    },
                    Self::EXECUTE => Some(Self::Execute),
                    Self::QUERY => Some(Self::Query),
                    _ => None
                };

                if instance.is_some() {
                    return instance;
                }
            }
        }
    
        None
    }

    #[inline]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Init { .. } => Self::INIT,
            Self::Execute => Self::EXECUTE,
            Self::Query => Self::QUERY
        }
    }
}

fn validate_entry_meta(list: &MetaList) -> bool {
    if let Some(first) = list.nested.first() {
        let ident = Ident::new(ENTRY_META, Span::call_site());
        let expected: NestedMeta = parse_quote!(#ident);

        if *first == expected {
            return true;
        }
    }

    false
}

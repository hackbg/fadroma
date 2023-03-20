use syn::{Attribute, Meta, NestedMeta, MetaList, Ident, parse_quote};
use proc_macro2::Span;

use crate::err::ErrorSink;

/// Name of the auto-generated struct that represents a contract or a module.
pub const CONTRACT: &str = "Contract";
/// Name of the auto-generated enum that aggregates
/// all error types that a contract might have.
pub const ERROR_ENUM: &str = "Error";
/// The [`ERROR_ENUM`] enum variant case that represents an error
/// returned by a method implemented on the current contract and
/// not one coming from an interface.
pub const CONTRACT_ERR_VARIANT: &str = "Base";
/// The [`ERROR_ENUM`] enum variant case that represents an error
/// when trying to convert a query response to binary.
pub const BINARY_SERIALIZE_ERR_VARIANT: &str = "QueryResponseSerialize";

pub const INIT_MSG: &str = "InstantiateMsg";
pub const EXECUTE_MSG: &str = "ExecuteMsg";
pub const QUERY_MSG: &str = "QueryMsg";

pub const INIT_FN: &str = "instantiate";
pub const EXECUTE_FN: &str = "execute";
pub const QUERY_FN: &str = "query";

/// Name of the associated type that represents the error type in an interface.
pub const ERROR_TYPE: &str = "Error";
/// Used as a meta tag in the `#[init(entry)]` attribute.
pub const ENTRY_META: &str = "entry";

#[derive(Clone, Copy, Debug)]
pub enum MsgAttr {
    Init { entry: bool },
    Execute,
    Query,
    ExecuteGuard
}

impl MsgAttr {
    pub const INIT: &str = "init";
    pub const EXECUTE: &str = "execute";
    pub const QUERY: &str = "query";
    pub const EXECUTE_GUARD: &str = "execute_guard";

    pub fn parse(sink: &mut ErrorSink, attrs: &[Attribute]) -> Option<Self> {
        for attr in attrs {
            if let Some(ident) = attr.path.get_ident() {
                let meta = match attr.parse_meta() {
                    Ok(meta) => meta,
                    Err(err) => {
                        sink.push_err(err);

                        continue;
                    }
                };

                let instance = match ident.to_string().as_str() {
                    Self::INIT => {
                        let mut entry = false;

                        if let Meta::List(list) = meta {
                            entry = validate_entry_meta(sink, &list);
                        } else {
                            assert_is_path_ident(sink, &meta);
                        }

                        Some(Self::Init { entry })
                    },
                    Self::EXECUTE => {
                        assert_is_path_ident(sink, &meta);

                        Some(Self::Execute)
                    }
                    Self::QUERY => {
                        assert_is_path_ident(sink, &meta);

                        Some(Self::Query)
                    },
                    Self::EXECUTE_GUARD => {
                        assert_is_path_ident(sink, &meta);

                        Some(Self::ExecuteGuard)
                    }
                    _ => None
                };

                if instance.is_some() {
                    return instance;
                }
            }
        }
    
        None
    }
}

fn validate_entry_meta(sink: &mut ErrorSink, list: &MetaList) -> bool {
    if let Some(first) = list.nested.first() {
        let ident = Ident::new(ENTRY_META, Span::call_site());
        let expected: NestedMeta = parse_quote!(#ident);

        if *first == expected {
            return true;
        }
    }

    sink.push_spanned(list, format!("Only valid nested meta in this position is \"{}\".", ENTRY_META));

    false
}

#[inline]
fn assert_is_path_ident(sink: &mut ErrorSink, meta: &Meta) {
    if !matches!(meta, Meta::Path(path) if path.segments.len() == 1) {
        sink.push_spanned(meta, "Unexpected meta.");
    }
}

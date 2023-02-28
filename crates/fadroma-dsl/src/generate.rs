use proc_macro2::{Span, TokenStream};
use syn::{
    TraitItemMethod, ItemStruct, Ident, Field, Fields, FieldsNamed,
    Visibility, parse_quote, FnArg, punctuated::Punctuated, Pat,
    ItemEnum, Variant, token::{Brace, Comma, Colon}
};
use quote::quote;

use crate::{err::ErrorSink, utils::to_pascal};

const INIT_MSG: &str = "InstantiateMsg";
const EXECUTE_MSG: &str = "ExecuteMsg";
const QUERY_MSG: &str = "QueryMsg";

#[derive(Clone, Copy)]
pub enum MsgType {
    Execute,
    Query
}

pub fn generate_init_msg(sink: &mut ErrorSink, init: Option<TraitItemMethod>) -> TokenStream {
    let Some(init) = init else {
        return TokenStream::new();
    };

    let msg = Ident::new(INIT_MSG, Span::call_site());

    let mut result: ItemStruct = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        pub struct #msg {

        }
    };

    let fields = extract_fields(sink, &init, parse_quote!(pub));
    result.fields = Fields::Named(fields);

    return quote!(#result);
}

pub fn generate_messages(
    sink: &mut ErrorSink,
    msg_type: MsgType,
    methods: &[TraitItemMethod]
) -> ItemEnum {
    let enum_name: Ident = msg_type.into();

    let mut result: ItemEnum = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        #[serde(rename_all = "snake_case")]
        pub enum #enum_name {

        }
    };

    for method in methods {
        let variant_name = to_pascal(&method.sig.ident.to_string());
        let fields = extract_fields(sink, method, Visibility::Inherited);

        result.variants.push(Variant {
            attrs: vec![],
            ident: Ident::new(&variant_name, Span::call_site()),
            fields: Fields::Named(fields),
            discriminant: None,
        });
    }

    result
}

fn extract_fields(
    sink: &mut ErrorSink,
    method: &TraitItemMethod,
    vis: Visibility
) -> FieldsNamed {
    let mut fields = FieldsNamed {
        brace_token: Brace(Span::call_site()),
        named: Punctuated::<Field, Comma>::default(),
    };

    for arg in method.sig.inputs.iter() {
        match arg {
            FnArg::Typed(pat_type) => {
                let ident = require_pat_ident(sink, *pat_type.pat.to_owned());

                fields.named.push(Field {
                    attrs: vec![],
                    vis: vis.clone(),
                    ident,
                    ty: *pat_type.ty.to_owned(),
                    colon_token: Some(Colon(Span::call_site())),
                });
            }
            FnArg::Receiver(_) => {
                sink.push_spanned(
                    arg,
                    "Method definition cannot contain \"self\"",
                );
            }
        }
    }

    fields
}

fn require_pat_ident(sink: &mut ErrorSink, pat: Pat) -> Option<Ident> {
    if let Pat::Ident(pat_ident) = pat {
        // Strip leading underscores because we might want to include a field in the
        // generated message, but not actually use it in the impl. A very rare case,
        // but it is used in the SNIP-20 implementation ('padding' field), for example.
        let name = pat_ident.ident.to_string();
        let name = name.trim_start_matches('_');

        Some(Ident::new(name, pat_ident.ident.span()))
    } else {
        sink.push_spanned(pat, "Expected identifier.");

        None
    }
}

impl From<MsgType> for Ident {
    #[inline]
    fn from(msg: MsgType) -> Self {
        match msg {
            MsgType::Execute => Self::new(EXECUTE_MSG, Span::call_site()),
            MsgType::Query => Self::new(QUERY_MSG, Span::call_site()),
        }
    }
}

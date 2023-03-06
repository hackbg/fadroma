use proc_macro2::Span;
use syn::{
    Signature, ItemStruct, Ident, Field, Fields, FieldsNamed,
    Visibility, parse_quote, FnArg, punctuated::Punctuated, Pat,
    ItemEnum, Variant, ItemFn, Expr, Stmt, ExprField, ExprMatch,
    token::{Brace, Comma, Colon}
};

use crate::{
    err::ErrorSink,
    attr::{
        MsgAttr, CONTRACT, INIT_MSG, EXECUTE_MSG,
        QUERY_MSG, INIT_FN, EXECUTE_FN, QUERY_FN
    },
    utils::to_pascal
};

#[derive(Clone, Copy)]
pub enum MsgType {
    Execute,
    Query
}

pub fn init_msg(sink: &mut ErrorSink, init: &Signature) -> ItemStruct {
    let msg = Ident::new(INIT_MSG, Span::call_site());

    let mut result: ItemStruct = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        pub struct #msg {

        }
    };

    let fields = extract_fields(sink, init, parse_quote!(pub));
    result.fields = Fields::Named(fields);

    return result;
}

pub fn messages<'a>(
    sink: &mut ErrorSink,
    msg_type: MsgType,
    signatures: impl Iterator<Item = &'a Signature>
) -> ItemEnum {
    let enum_name: Ident = msg_type.into();

    let mut result: ItemEnum = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        #[serde(rename_all = "snake_case")]
        pub enum #enum_name {

        }
    };

    for sig in signatures {
        let variant_name = to_pascal(&sig.ident.to_string());
        let fields = extract_fields(sink, sig, Visibility::Inherited);

        result.variants.push(Variant {
            attrs: vec![],
            ident: Ident::new(&variant_name, Span::call_site()),
            fields: Fields::Named(fields),
            discriminant: None
        });
    }

    result
}

pub fn init_fn(sink: &mut ErrorSink, sig: &Signature) -> Option<ItemFn> {
    let fn_name = Ident::new(INIT_FN, Span::call_site());
    let msg = Ident::new(INIT_MSG, Span::call_site());

    let mut result: ItemFn = parse_quote! {
        pub fn #fn_name(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            msg: #msg
        ) { }
    };

    result.sig.output = sig.output.clone();

    let mut args = Punctuated::<ExprField, Comma>::new();

    for input in &sig.inputs {
        let ident = fn_arg_ident(sink, input)?;

        args.push_value(parse_quote!(msg.#ident));
        args.push_punct(Comma(Span::call_site()));
    }

    let ref method_name = sig.ident;
    let contract_ident = Ident::new(CONTRACT, Span::call_site());

    let call: Expr = parse_quote!(#contract_ident::#method_name(deps, env, info, #args));
    result.block.stmts.push(Stmt::Expr(call));

    Some(result)
}

pub fn execute_fn<'a>(
    sink: &mut ErrorSink,
    signatures: impl Iterator<Item = &'a Signature>
) -> ItemFn {
    let fn_name = Ident::new(EXECUTE_FN, Span::call_site());
    let msg = Ident::new(EXECUTE_MSG, Span::call_site());

    let mut result: ItemFn = parse_quote! {
        pub fn #fn_name(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            msg: #msg
        ) { }
    };

    let mut signatures = signatures.peekable();
    match signatures.peek() {
        Some(next) => {
            result.sig.output = next.output.clone();

            if let Some(match_expr) = create_match_expr(sink, signatures, MsgType::Execute) {
                result.block.stmts.push(Stmt::Expr(match_expr));
            }
        },
        None => {
            result.sig.output = parse_quote!(-> cosmwasm_std::StdResult<cosmwasm_std::Response>);

            let expr: Expr = parse_quote!(Ok(cosmwasm_std::Response::new()));
            result.block.stmts.push(Stmt::Expr(expr));
        }
    }

    result
}

pub fn query_fn<'a>(
    sink: &mut ErrorSink,
    signatures: impl Iterator<Item = &'a Signature>
) -> ItemFn {
    let fn_name = Ident::new(QUERY_FN, Span::call_site());
    let msg = Ident::new(QUERY_MSG, Span::call_site());

    let mut result: ItemFn = parse_quote! {
        pub fn #fn_name(
            deps: cosmwasm_std::Deps,
            env: cosmwasm_std::Env,
            msg: #msg
        ) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> { }
    };

    if let Some(match_expr) = create_match_expr(sink, signatures, MsgType::Query) {
        result.block.stmts.push(Stmt::Expr(match_expr));
    }

    result
}

pub fn cw_arguments(sig: &mut Signature, attr: MsgAttr, has_block: bool) {
    match attr {
        MsgAttr::Init { .. } | MsgAttr::Execute => {
            if has_block {
                sig.inputs.insert(0, parse_quote!(mut deps: cosmwasm_std::DepsMut));
            } else {
                sig.inputs.insert(0, parse_quote!(deps: cosmwasm_std::DepsMut));
            }

            sig.inputs.insert(1, parse_quote!(env: cosmwasm_std::Env));
            sig.inputs.insert(2, parse_quote!(info: cosmwasm_std::MessageInfo));
        },
        MsgAttr::Query => {
            sig.inputs.insert(0, parse_quote!(deps: cosmwasm_std::Deps));
            sig.inputs.insert(1, parse_quote!(env: cosmwasm_std::Env));
        }
    }
}

fn create_match_expr<'a>(
    sink: &mut ErrorSink,
    signatures: impl Iterator<Item = &'a Signature>,
    msg_type: MsgType
) -> Option<Expr> {
    let enum_name: Ident = msg_type.into();
    let contract_ident = Ident::new(CONTRACT, Span::call_site());

    let mut match_expr: ExprMatch = parse_quote!(match msg {});

    for sig in signatures {
        let ref method_name = sig.ident;

        let variant = to_pascal(&method_name.to_string());
        let variant = Ident::new(&variant, Span::call_site());

        let mut args = Punctuated::<Ident, Comma>::new();

        for input in &sig.inputs {
            let ident = fn_arg_ident(sink, input)?;

            args.push_value(ident);
            args.push_punct(Comma(Span::call_site()));
        }

        match msg_type {
            MsgType::Execute => {
                match_expr.arms.push(
                    parse_quote!(#enum_name::#variant { #args } =>
                        #contract_ident::#method_name(deps, env, info, #args)
                    )
                );
            }
            MsgType::Query => {
                match_expr.arms.push(parse_quote! {
                    #enum_name::#variant { #args } => {
                        let result = #contract_ident::#method_name(deps, env, #args)?;

                        cosmwasm_std::to_binary(&result)
                    }
                });
            }
        }
    }

    Some(Expr::Match(match_expr))
}

fn extract_fields(
    sink: &mut ErrorSink,
    sig: &Signature,
    vis: Visibility
) -> FieldsNamed {
    let mut fields = FieldsNamed {
        brace_token: Brace(Span::call_site()),
        named: Punctuated::<Field, Comma>::default(),
    };

    for arg in sig.inputs.iter() {
        match arg {
            FnArg::Typed(pat_type) => {
                let ident = pat_ident(sink, *pat_type.pat.to_owned());

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

#[inline]
fn fn_arg_ident(sink: &mut ErrorSink, arg: &FnArg) -> Option<Ident> {
    match arg {
        FnArg::Typed(pat_type) => pat_ident(sink, *pat_type.pat.to_owned()),
        FnArg::Receiver(_) => {
            sink.push_spanned(
                &arg,
                "Method definition cannot contain \"self\".",
            );

            None
        }
    }
}

fn pat_ident(sink: &mut ErrorSink, pat: Pat) -> Option<Ident> {
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
            MsgType::Query => Self::new(QUERY_MSG, Span::call_site())
        }
    }
}

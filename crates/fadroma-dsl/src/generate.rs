use syn::{
    Signature, ItemStruct, Ident, Field, Fields, FieldsNamed,
    Visibility, parse_quote, FnArg, punctuated::Punctuated,
    ItemEnum, Variant, ItemFn, Expr, Stmt, ExprField, ExprMatch,
    ItemImpl, GenericArgument, ExprCall, ReturnType, Type, Item,
    ItemMod, token::{Brace, Comma, Colon, RArrow}
};
use proc_macro2::Span;

use crate::{
    err::ErrorSink,
    attr::{
        MsgAttr, CONTRACT, INIT_MSG, EXECUTE_MSG,
        QUERY_MSG, INIT_FN, EXECUTE_FN, QUERY_FN,
        ERROR_ENUM, ERROR_TYPE, CONTRACT_ERR_VARIANT,
        BINARY_SERIALIZE_ERR_VARIANT
    },
    method::{Method, fn_args_to_idents, fn_arg_ident, pat_ident},
    utils::to_pascal
};

#[derive(Clone, Copy)]
pub enum MsgType {
    Execute,
    Query
}

pub struct ErrorEnum {
    pub enum_def: ItemEnum,
    pub display_impl: ItemImpl,
    pub err_impl: ItemImpl
}

pub fn init_msg(sink: &mut ErrorSink, init: &Method<'_>) -> ItemStruct {
    let msg = Ident::new(INIT_MSG, Span::call_site());

    let mut result: ItemStruct = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        pub struct #msg {

        }
    };

    let fields = extract_fields(sink, init.sig(), parse_quote!(pub));
    result.fields = Fields::Named(fields);

    return result;
}

pub fn messages(
    sink: &mut ErrorSink,
    msg_type: MsgType,
    methods: &[Method<'_>]
) -> ItemEnum {
    let enum_name: Ident = msg_type.into();

    let mut result: ItemEnum = parse_quote! {
        #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
        #[serde(rename_all = "snake_case")]
        pub enum #enum_name {

        }
    };

    for method in methods {
        let sig = method.sig();
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

pub fn init_fn(sink: &mut ErrorSink, method: &Method<'_>) -> ItemFn {
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

    let sig = method.sig();

    let mut args = Punctuated::<ExprField, Comma>::new();

    for input in &sig.inputs {
        if let Some(ident) = fn_arg_ident(sink, input) {
            args.push_value(parse_quote!(msg.#ident));
            args.push_punct(Comma(Span::call_site()));
        }
    }

    let ref method_name = sig.ident;
    let contract_ident = Ident::new(CONTRACT, Span::call_site());

    let (expr, output) = match method {
        Method::Contract(_) => (
            parse_quote!(#contract_ident::#method_name(deps, env, info, #args)),
            sig.output.clone()
        ),
        Method::Interface(interface) => {
            let trait_name = interface.trait_name();
            let error_enum = Ident::new(ERROR_TYPE, Span::call_site());

            let return_ty: Type = parse_quote!(Result<cosmwasm_std::Response, <#contract_ident as #trait_name>::#error_enum>);

            (
                parse_quote!(<#contract_ident as #trait_name>::#method_name(deps, env, info, #args)),
                ReturnType::Type(RArrow::default(), Box::new(return_ty))
            )
        }
    };

    result.block.stmts.push(Stmt::Expr(expr));
    result.sig.output = output;

    result
}

pub fn execute_fn(
    sink: &mut ErrorSink,
    methods: &[Method<'_>],
    execute_guard: Option<Method<'_>>
) -> ItemFn {
    let fn_name = Ident::new(EXECUTE_FN, Span::call_site());
    let msg = Ident::new(EXECUTE_MSG, Span::call_site());
    let error_enum = Ident::new(ERROR_ENUM, Span::call_site());

    let mut result: ItemFn = parse_quote! {
        pub fn #fn_name(
            mut deps: cosmwasm_std::DepsMut,
            env: cosmwasm_std::Env,
            info: cosmwasm_std::MessageInfo,
            msg: #msg
        ) -> std::result::Result<cosmwasm_std::Response, #error_enum> { }
    };

    if let Some(guard) = execute_guard {
        assert!(matches!(guard.ty(), MsgAttr::ExecuteGuard));
        
        let contract_ident = Ident::new(CONTRACT, Span::call_site());
        let method_name = &guard.sig().ident;

        let err_variant = Ident::new(CONTRACT_ERR_VARIANT, Span::call_site());
        let map_err: ExprCall = parse_quote!(map_err(|x| #error_enum::#err_variant(x)));

        result.block.stmts.push(parse_quote! {
            #contract_ident::#method_name(deps.branch(), &env, &info, &msg).#map_err?;
        });
    }

    if methods.is_empty() {
        result.sig.output = parse_quote!(-> cosmwasm_std::StdResult<cosmwasm_std::Response>);

        let expr: Expr = parse_quote!(Ok(cosmwasm_std::Response::new()));
        result.block.stmts.push(Stmt::Expr(expr));
    } else {
        if let Some(match_expr) = create_match_expr(sink, methods, MsgType::Execute) {
            result.block.stmts.push(Stmt::Expr(match_expr));
        }
    }

    result
}

pub fn query_fn(
    sink: &mut ErrorSink,
    methods: &[Method<'_>]
) -> ItemFn {
    let fn_name = Ident::new(QUERY_FN, Span::call_site());
    let msg = Ident::new(QUERY_MSG, Span::call_site());
    let error_enum = Ident::new(ERROR_ENUM, Span::call_site());

    let mut result: ItemFn = parse_quote! {
        pub fn #fn_name(
            deps: cosmwasm_std::Deps,
            env: cosmwasm_std::Env,
            msg: #msg
        ) -> std::result::Result<cosmwasm_std::Binary, #error_enum> { }
    };

    if methods.is_empty() {
        let serialize_err_variant = Ident::new(BINARY_SERIALIZE_ERR_VARIANT, Span::call_site());
        let expr: Expr = parse_quote! {
            cosmwasm_std::to_binary(&cosmwasm_std::Empty { }).map_err(|x|
                #error_enum::#serialize_err_variant(x.to_string())
            )
        };

        result.block.stmts.push(Stmt::Expr(expr));
    } else {
        if let Some(match_expr) = create_match_expr(sink, methods, MsgType::Query) {
            result.block.stmts.push(Stmt::Expr(match_expr));
        }
    }

    result
}

pub fn wasm_entry(reply: &Option<Method<'_>>) -> ItemMod {
    let init_fn = Ident::new(INIT_FN, Span::call_site());
    let execute_fn = Ident::new(EXECUTE_FN, Span::call_site());
    let query_fn = Ident::new(QUERY_FN, Span::call_site());

    let mut result: ItemMod = parse_quote! {
        #[cfg(target_arch = "wasm32")]
        mod wasm_entry {
            use super::cosmwasm_std::{do_instantiate, do_execute, do_query, do_reply};

            #[no_mangle]
            extern "C" fn instantiate(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
                do_instantiate(&super::#init_fn, env_ptr, info_ptr, msg_ptr)
            }

            #[no_mangle]
            extern "C" fn execute(env_ptr: u32, info_ptr: u32, msg_ptr: u32) -> u32 {
                do_execute(&super::#execute_fn, env_ptr, info_ptr, msg_ptr)
            }

            #[no_mangle]
            extern "C" fn query(env_ptr: u32, msg_ptr: u32) -> u32 {
                do_query(&super::#query_fn, env_ptr, msg_ptr)
            }
        }
    };

    if let Some(reply) = reply {
        let contract = Ident::new(CONTRACT, Span::call_site());
        let reply_fn = &reply.sig().ident;
        
        let entry = parse_quote! {
            #[no_mangle]
            extern "C" fn reply(env_ptr: u32, msg_ptr: u32) -> u32 {
                do_reply(&super::#contract::#reply_fn, env_ptr, msg_ptr)
            }
        };

        result.content.as_mut().unwrap().1.push(Item::Fn(entry));
    }

    result
}

pub fn error_enum(
    sink: &mut ErrorSink,
    contract: Option<GenericArgument>,
    interfaces: &[&ItemImpl]
) -> ErrorEnum {
    let name = Ident::new(ERROR_ENUM, Span::call_site());
    let serialize_err_variant = Ident::new(BINARY_SERIALIZE_ERR_VARIANT, Span::call_site());

    let fmt_arg = Ident::new("f", Span::call_site());
    let tuple_arg = Ident::new("x", Span::call_site());
    let fmt_call: Expr = parse_quote!(std::fmt::Display::fmt(#tuple_arg, #fmt_arg));

    let mut match_expr: ExprMatch = parse_quote!(
        match self {
            Self::#serialize_err_variant(msg) =>
                #fmt_arg.write_fmt(format_args!("Error serializing query response: {}", msg))
        }
    );
    let mut enum_def: ItemEnum = parse_quote!(
        #[derive(Debug)]
        pub enum #name {
            #[doc(hidden)]
            #serialize_err_variant(String)
        }
    );

    if let Some(contract) = contract {
        if let GenericArgument::Type(ty) = contract {
            let contract_variant = Ident::new(CONTRACT_ERR_VARIANT, Span::call_site());
            let variant = parse_quote!(#contract_variant(#ty));
            enum_def.variants.push(variant);

            let arm = parse_quote!(Self::#contract_variant(#tuple_arg) => #fmt_call);
            match_expr.arms.push(arm);
        } else {
            sink.push_spanned(
                contract,
                "Unexpected generic argument type. Either a type that won't compile was provided or this is a bug in the macro."
            );
        }
    }

    let contract_struct = Ident::new(CONTRACT, Span::call_site());
    let error_ty = Ident::new(ERROR_TYPE, Span::call_site());

    for interface in interfaces {
        let Some(r#trait) = &interface.trait_ else {
            unreachable!("A non-trait impl was provided. This is a bug.");
        };

        let trait_path = &r#trait.1;
        let trait_name = &trait_path.segments.last().unwrap().ident;

        let variant = parse_quote!(#trait_name(<#contract_struct as #trait_path>::#error_ty));
        enum_def.variants.push(variant);

        let arm = parse_quote!(Self::#trait_name(#tuple_arg) => #fmt_call);
        match_expr.arms.push(arm);
    }

    let display_impl: ItemImpl = parse_quote! {
        impl std::fmt::Display for #name {
            fn fmt(&self, #fmt_arg: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                #match_expr
            }
        }
    };

    let err_impl: ItemImpl = parse_quote! {
        impl std::error::Error for #name { }
    };

    ErrorEnum {
        enum_def,
        display_impl,
        err_impl
    }
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
        MsgAttr::Reply => {
            sig.inputs.insert(0, parse_quote!(mut deps: cosmwasm_std::DepsMut));
            sig.inputs.insert(1, parse_quote!(env: cosmwasm_std::Env));
        }
        MsgAttr::Query => {
            sig.inputs.insert(0, parse_quote!(deps: cosmwasm_std::Deps));
            sig.inputs.insert(1, parse_quote!(env: cosmwasm_std::Env));
        },
        MsgAttr::ExecuteGuard => {
            sig.inputs.insert(0, parse_quote!(mut deps: cosmwasm_std::DepsMut));
            sig.inputs.insert(1, parse_quote!(env: &cosmwasm_std::Env));
            sig.inputs.insert(2, parse_quote!(info: &cosmwasm_std::MessageInfo));
        }
    }
}

fn create_match_expr(
    sink: &mut ErrorSink,
    methods: &[Method<'_>],
    msg_type: MsgType
) -> Option<Expr> {
    let enum_name: Ident = msg_type.into();
    let contract_ident = Ident::new(CONTRACT, Span::call_site());

    let error_enum = Ident::new(ERROR_ENUM, Span::call_site());
    let contract_err_variant = Ident::new(CONTRACT_ERR_VARIANT, Span::call_site());
    let serialize_err_variant = Ident::new(BINARY_SERIALIZE_ERR_VARIANT, Span::call_site());

    let mut match_expr: ExprMatch = parse_quote!(match msg {});

    for method in methods {
        let sig = method.sig();
        let ref method_name = sig.ident;

        let variant = to_pascal(&method_name.to_string());
        let variant = Ident::new(&variant, Span::call_site());

        let args = fn_args_to_idents(sink, &sig.inputs);

        let err_variant = if let Method::Interface(interface) = method {
            interface.trait_name()
        } else {
            &contract_err_variant
        };

        let map_err: ExprCall = parse_quote!(map_err(|x| #error_enum::#err_variant(x)));
        let map_err = Expr::Call(map_err);

        match msg_type {
            MsgType::Execute => {
                match_expr.arms.push(
                    parse_quote!(#enum_name::#variant { #args } =>
                        #contract_ident::#method_name(deps, env, info, #args).#map_err
                    )
                );
            }
            MsgType::Query => {
                match_expr.arms.push(parse_quote! {
                    #enum_name::#variant { #args } => {
                        let result = #contract_ident::#method_name(deps, env, #args).#map_err?;

                        cosmwasm_std::to_binary(&result).map_err(|x| #error_enum::#serialize_err_variant(x.to_string()))
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

impl From<MsgType> for Ident {
    #[inline]
    fn from(msg: MsgType) -> Self {
        match msg {
            MsgType::Execute => Self::new(EXECUTE_MSG, Span::call_site()),
            MsgType::Query => Self::new(QUERY_MSG, Span::call_site())
        }
    }
}

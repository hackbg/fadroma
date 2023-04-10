#![doc = include_str!("../README.md")]

mod interface;
mod contract;
mod attr;
mod err;
mod generate;
mod validate;
mod method;
mod auto_impl;
mod execute_guard;
mod reply;
mod utils;

use syn::{
    AttributeArgs, Item, ItemTrait, TraitItemMethod, ItemFn,
    ItemImpl, ItemMod, parse_macro_input, parse_quote
};
use proc_macro2::Span;
use quote::quote;

use auto_impl::AutoImpl;
use attr::MsgAttr;

#[proc_macro_attribute]
pub fn interface(
    _args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(trait_ as ItemTrait);
    let item_trait = quote!(#item);

    let boilerplate = match interface::derive(item) {
        Ok(stream) => stream,
        Err(errors) => to_compile_errors(errors)
    };

    let result = quote! {
        #item_trait
        #boilerplate
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn contract(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as ItemMod);

    let boilerplate = match contract::derive(item) {
        Ok(stream) => stream,
        Err(errors) => to_compile_errors(errors)
    };

    proc_macro::TokenStream::from(boilerplate)
}

#[proc_macro_attribute]
pub fn auto_impl(
    args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let args = parse_macro_input!(args as AttributeArgs);
    let mut item = parse_macro_input!(item as ItemImpl);

    let result = match AutoImpl::parse(args) {
        Ok(auto_impl) => {
            match auto_impl.replace(&mut item) {
                Ok(()) => quote!(#item),
                Err(errors) => to_compile_errors(errors)
            }
        }
        Err(err) => err.to_compile_error()
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn init(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as Item);
    let result = add_fn_args(item, MsgAttr::Init { entry: None });

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn execute(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as Item);
    let result = add_fn_args(item, MsgAttr::Execute);

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn query(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as Item);
    let result = add_fn_args(item, MsgAttr::Query);

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn execute_guard(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as ItemFn);

    let result = match execute_guard::derive(item) {
        Ok(stream) => stream,
        Err(errors) => to_compile_errors(errors)
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn reply(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(item as ItemFn);

    let result = match reply::derive(item) {
        Ok(stream) => stream,
        Err(errors) => to_compile_errors(errors)
    };

    proc_macro::TokenStream::from(result)
}

fn add_fn_args(mut item: Item, attr: MsgAttr) -> proc_macro2::TokenStream {
    match &mut item {
        Item::Fn(item) => {
            generate::cw_arguments(&mut item.sig, attr, true);

            quote!(#item)
        },
        Item::Verbatim(stream) => {
            let mut item: TraitItemMethod = parse_quote!(#stream);
            generate::cw_arguments(&mut item.sig, attr, item.default.is_some());

            quote!(#item)
        },
        _ => return syn::Error::new(
            Span::call_site(),
            "This macro is only valid for methods."
        ).to_compile_error()
    }
}

fn to_compile_errors(errors: Vec<syn::Error>) -> proc_macro2::TokenStream {
    let compile_errors = errors.iter().map(syn::Error::to_compile_error);

    quote!(#(#compile_errors)*)
}

mod interface;
mod attr;
mod err;
mod generate;
mod utils;

use syn::{parse_macro_input, ItemTrait, TraitItemMethod, parse_quote};
use quote::quote;

use interface::Interface;

#[proc_macro_attribute]
pub fn interface(
    _args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let item = parse_macro_input!(trait_ as ItemTrait);
    let item_trait = quote!(#item);

    let boilerplate = match Interface::derive(item) {
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
pub fn init(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_fn_args(&mut ast, true, false, false);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn execute(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_fn_args(&mut ast, true, false, false);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn query(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_fn_args(&mut ast, false, false, false);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

fn add_fn_args(func: &mut TraitItemMethod, is_tx: bool, ref_env: bool, ref_info: bool) {
    func.sig.inputs.insert(0, parse_quote!(&self));

    if is_tx {
        if func.default.is_none() {
            func.sig
                .inputs
                .push(parse_quote!(deps: cosmwasm_std::DepsMut));
        } else {
            func.sig
                .inputs
                .push(parse_quote!(mut deps: cosmwasm_std::DepsMut));
        }
        if ref_env {
            func.sig.inputs.push(parse_quote!(env: &cosmwasm_std::Env));
        } else {
            func.sig.inputs.push(parse_quote!(env: cosmwasm_std::Env));
        }
        if ref_info {
            func.sig
                .inputs
                .push(parse_quote!(info: &cosmwasm_std::MessageInfo));
        } else {
            func.sig
                .inputs
                .push(parse_quote!(info: cosmwasm_std::MessageInfo));
        }
    } else {
        func.sig.inputs.push(parse_quote!(deps: cosmwasm_std::Deps));
        func.sig.inputs.push(parse_quote!(env: cosmwasm_std::Env));
    }
}

fn to_compile_errors(errors: Vec<syn::Error>) -> proc_macro2::TokenStream {
    let compile_errors = errors.iter().map(syn::Error::to_compile_error);

    quote!(#(#compile_errors)*)
}

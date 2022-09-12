use quote::quote;
use syn::{parse_macro_input, parse_quote, AttributeArgs, ItemEnum, ItemTrait, TraitItemMethod};

use crate::contract::{Contract, ContractType};
use crate::deserialize_flat::impl_deserialize_flat;

mod args;
mod attr;
mod contract;
mod deserialize_flat;
mod utils;

#[proc_macro_attribute]
pub fn contract(
    args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Contract)
}

#[proc_macro_attribute]
pub fn interface(
    args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Interface)
}

#[proc_macro_attribute]
pub fn contract_impl(
    args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Impl)
}

#[proc_macro_attribute]
pub fn init(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_fn_args(&mut ast, true);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn handle(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_fn_args(&mut ast, true);

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

    add_fn_args(&mut ast, false);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_derive(DeserializeFlat)]
pub fn deserialize_flat(item: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let ast = parse_macro_input!(item as ItemEnum);

    let impl_item = impl_deserialize_flat(&ast);

    let result = quote! {
        #impl_item
    };

    proc_macro::TokenStream::from(result)
}

fn generate_contract(
    args: proc_macro::TokenStream,
    trait_: proc_macro::TokenStream,
    ty: ContractType,
) -> proc_macro::TokenStream {
    let args = parse_macro_input!(args as AttributeArgs);
    let ast = parse_macro_input!(trait_ as ItemTrait);

    let item_trait = quote!(#ast);

    let contract = Contract::parse(args, ast, ty);

    let boilerplate = match contract {
        Ok(contract) => contract
            .generate_boilerplate()
            .unwrap_or_else(|x| x.into_compile_error()),
        Err(err) => err.to_compile_error(),
    };

    let result = quote! {
        #item_trait
        #boilerplate
    };

    proc_macro::TokenStream::from(result)
}

fn add_fn_args(func: &mut TraitItemMethod, is_tx: bool) {
    func.sig.inputs.insert(0, parse_quote!(&self));

    if is_tx {
        func.sig
            .inputs
            .push(parse_quote!(deps: cosmwasm_std::DepsMut));
        func.sig.inputs.push(parse_quote!(env: cosmwasm_std::Env));
        func.sig
            .inputs
            .push(parse_quote!(info: cosmwasm_std::MessageInfo));
    } else {
        func.sig.inputs.push(parse_quote!(deps: cosmwasm_std::Deps));
        func.sig.inputs.push(parse_quote!(env: cosmwasm_std::Env));
    }
}

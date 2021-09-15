use syn::{
    AttributeArgs, TraitItemMethod, ItemTrait, ItemEnum,
    parse_macro_input, parse_quote
};
use quote::quote;

use crate::contract::{Contract, ContractType};
use crate::deserialize_flat::impl_deserialize_flat;

mod contract;
mod args;
mod utils;
mod deserialize_flat;

#[proc_macro_attribute]
pub fn contract(args: proc_macro::TokenStream, trait_: proc_macro::TokenStream) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Contract)
}

#[proc_macro_attribute]
pub fn interface(args: proc_macro::TokenStream, trait_: proc_macro::TokenStream) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Interface)
}

#[proc_macro_attribute]
pub fn contract_impl(args: proc_macro::TokenStream, trait_: proc_macro::TokenStream) -> proc_macro::TokenStream {
    generate_contract(args, trait_, ContractType::Impl)
}

#[proc_macro_attribute]
pub fn init(_args: proc_macro::TokenStream, func: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_deps_generics(&mut ast);
    add_fn_args(&mut ast, true);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn handle(_args: proc_macro::TokenStream, func: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_deps_generics(&mut ast);
    add_fn_args(&mut ast, true);

    let result = quote! {
        #ast
    };

    proc_macro::TokenStream::from(result)
}

#[proc_macro_attribute]
pub fn query(_args: proc_macro::TokenStream, func: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    add_deps_generics(&mut ast);
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
    ty: ContractType
) -> proc_macro::TokenStream {
    let args = parse_macro_input!(args as AttributeArgs);
    let ast = parse_macro_input!(trait_ as ItemTrait);

    let item_trait = quote!(#ast);

    let contract = Contract::parse(args, ast, ty);

    let boilerplate = match contract {
        Ok(contract) => {
            contract.generate_boilerplate().unwrap_or_else(|x| x.into_compile_error())
        },
        Err(err) => err.to_compile_error()
    };

    let result = quote! {
        #item_trait
        #boilerplate
    };

    proc_macro::TokenStream::from(result)
}

fn add_deps_generics(func: &mut TraitItemMethod) {    
    func.sig.generics.params.push(parse_quote!(S: cosmwasm_std::Storage));
    func.sig.generics.params.push(parse_quote!(A: cosmwasm_std::Api));
    func.sig.generics.params.push(parse_quote!(Q: cosmwasm_std::Querier));
}

fn add_fn_args(func: &mut TraitItemMethod, is_tx: bool) {
    func.sig.inputs.insert(0, parse_quote!(&self));
    
    if is_tx {
        func.sig.inputs.push(parse_quote!(deps: &mut cosmwasm_std::Extern<S, A, Q>));
        func.sig.inputs.push(parse_quote!(env: cosmwasm_std::Env));
    } else {
        func.sig.inputs.push(parse_quote!(deps: &cosmwasm_std::Extern<S, A, Q>));
    }
}

use quote::quote;
use syn::{parse_macro_input, parse_quote, AttributeArgs, ItemTrait, TraitItemMethod};

use crate::contract::{Contract, ContractType};

mod args;
mod attr;
mod contract;
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

#[proc_macro_attribute]
pub fn execute_guard(
    _args: proc_macro::TokenStream,
    func: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let mut ast = parse_macro_input!(func as TraitItemMethod);

    if ast.sig.inputs.len() != 1 {
        let err = syn::Error::new(
            ast.sig.paren_token.span,
            format!(
                "Expecting one parameter with the type: &{}",
                contract::EXECUTE_MSG
            ),
        )
        .to_compile_error();

        return proc_macro::TokenStream::from(err);
    }

    add_fn_args(&mut ast, true, true, true);

    let result = quote! {
        #ast
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

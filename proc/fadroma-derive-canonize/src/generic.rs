use syn::{ItemStruct, ItemImpl, parse_quote};
use proc_macro2::Span;
use quote::quote;

use crate::common::canonize_fields;

pub fn generate(strukt: ItemStruct) -> proc_macro::TokenStream {
    if strukt.generics.params.len() > 1 {
        let err = syn::Error::new(
            Span::call_site(),
            "Structs with multiple generic arguments are currently not supported."
        ).into_compile_error();

        return proc_macro::TokenStream::from(quote!(#err))
    }

    let impls = generate_trait_impls(&strukt);

    proc_macro::TokenStream::from(quote!(#impls))
}

fn generate_trait_impls(strukt: &ItemStruct) -> proc_macro2::TokenStream {
    let ident = &strukt.ident;

    let fields = canonize_fields(&strukt.fields, true);
    let canonize_impl: ItemImpl = parse_quote! {
        #[automatically_derived]
        impl fadroma::prelude::Canonize for #ident<cosmwasm_std::Addr> {
            type Output = #ident<cosmwasm_std::CanonicalAddr>;

            fn canonize(self, api: &dyn cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#ident #fields)
            }
        }
    };

    let fields = canonize_fields(&strukt.fields, false);
    let humanize_impl: ItemImpl = parse_quote! {
        #[automatically_derived]
        impl fadroma::prelude::Humanize for #ident<cosmwasm_std::CanonicalAddr> {
            type Output = #ident<cosmwasm_std::Addr>;

            fn humanize(self, api: &dyn cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#ident #fields)
            }
        }
    };

    quote! {
        #canonize_impl
        #humanize_impl
    }
}

use syn::{ItemStruct, Ident, Fields, ItemImpl, parse_quote};
use proc_macro2::Span;
use quote::quote;

use crate::common::canonize_fields;

const CANONIZED_POSTFIX: &str = "Canon";

pub fn generate(mut strukt: ItemStruct) -> proc_macro::TokenStream {
    let original_ident = strukt.ident;
    strukt.ident = Ident::new(&format!("{}{}", original_ident, CANONIZED_POSTFIX), Span::call_site());

    add_serde_derive(&mut strukt);

    if let Err(err) = transform_fields(&mut strukt.fields) {
        let err = err.into_compile_error();

        return proc_macro::TokenStream::from(quote!(#err))
    }

    let impls = generate_trait_impls(&strukt, &original_ident);

    proc_macro::TokenStream::from(quote!{
        #strukt
        #impls
    })
}

fn transform_fields(fields: &mut Fields) -> syn::Result<()> {
    match fields {
        Fields::Named(fields) => {
            for mut field in fields.named.iter_mut() {
                let ty = &field.ty;
                field.ty = parse_quote!(<#ty as fadroma::prelude::Canonize>::Output);
            }
        },
        Fields::Unnamed(fields) => {
            for mut field in fields.unnamed.iter_mut() {
                let ty = &field.ty;
                field.ty = parse_quote!(<#ty as fadroma::prelude::Canonize>::Output);
            }
        },
        Fields::Unit => return Err(syn::Error::new(Span::call_site(), "Unit structs are not supported."))
    }

    Ok(())
}

fn add_serde_derive(strukt: &mut ItemStruct) {
    strukt.attrs.clear();
    strukt.attrs.push(parse_quote!(#[derive(serde::Serialize)]));
    strukt.attrs.push(parse_quote!(#[derive(serde::Deserialize)]));
}

fn generate_trait_impls(strukt: &ItemStruct, humanized: &Ident) -> proc_macro2::TokenStream {
    let canonized = &strukt.ident;
    let fields = canonize_fields(&strukt.fields, true);
    let canonize_impl: ItemImpl = parse_quote! {
        impl fadroma::prelude::Canonize for #humanized {
            type Output = #canonized;

            fn canonize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#canonized #fields)
            }
        }
    };

    let fields = canonize_fields(&strukt.fields, false);
    let humanize_impl: ItemImpl = parse_quote! {
        impl fadroma::prelude::Humanize for #canonized {
            type Output = #humanized;

            fn humanize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#humanized #fields)
            }
        }
    };
    quote! {
        #canonize_impl
        #humanize_impl
    }
}

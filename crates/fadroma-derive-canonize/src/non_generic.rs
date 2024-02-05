use proc_macro2::Span;
use quote::quote;
use syn::{parse_quote, Ident, ItemImpl, ItemStruct};

use crate::common::{add_serde_derive, canonize_fields, transform_fields, CANONIZED_POSTFIX};

pub fn generate(mut strukt: ItemStruct) -> proc_macro::TokenStream {
    let original_ident = strukt.ident;
    strukt.ident = Ident::new(
        &format!("{}{}", original_ident, CANONIZED_POSTFIX),
        Span::call_site(),
    );

    add_serde_derive(&mut strukt.attrs);
    
    if let Err(err) = transform_fields(&mut strukt.fields) {
        let err = err.into_compile_error();

        return proc_macro::TokenStream::from(quote!(#err));
    }

    let impls = generate_trait_impls(&strukt, &original_ident);

    proc_macro::TokenStream::from(quote! {
        #strukt
        #impls
    })
}

fn generate_trait_impls(strukt: &ItemStruct, humanized: &Ident) -> proc_macro2::TokenStream {
    let canonized = &strukt.ident;
    let fields = canonize_fields(&strukt.fields, true);
    let canonize_impl: ItemImpl = parse_quote! {
        #[automatically_derived]
        impl fadroma::prelude::Canonize for #humanized {
            type Output = #canonized;

            fn canonize(self, api: &dyn cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#canonized #fields)
            }
        }
    };

    let fields = canonize_fields(&strukt.fields, false);
    let humanize_impl: ItemImpl = parse_quote! {
        #[automatically_derived]
        impl fadroma::prelude::Humanize for #canonized {
            type Output = #humanized;

            fn humanize(self, api: &dyn cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#humanized #fields)
            }
        }
    };

    quote! {
        #canonize_impl
        #humanize_impl
    }
}

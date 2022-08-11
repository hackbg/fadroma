use super::r#enum::generate_match_arms;
use proc_macro2::Span;
use quote::quote;
use syn::ItemEnum;

pub fn generate(mut input: ItemEnum) -> proc_macro::TokenStream {
    if input.generics.params.len() > 1 {
        let err = syn::Error::new(
            Span::call_site(),
            "Enums with multiple generic arguments current not supported.",
        )
        .into_compile_error();

        return proc_macro::TokenStream::from(quote!(#err));
    }

    let ident = &input.ident;

    let mut variants = &mut input.variants;
    let canonize_impl = generate_match_arms(&mut variants, &ident, &ident, true);
    let humanize_impl = generate_match_arms(&mut variants, &ident, &ident, false);

    proc_macro::TokenStream::from(quote! {
        impl fadroma::prelude::Canonize for #ident<cosmwasm_std::HumanAddr> {
            type Output = #ident<cosmwasm_std::CanonicalAddr>;

            fn canonize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(match self {
                    #canonize_impl
                })
            }
        }

        impl fadroma::prelude::Humanize for #ident<cosmwasm_std::CanonicalAddr> {
            type Output = #ident<cosmwasm_std::HumanAddr>;

            fn humanize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(match self {
                    #humanize_impl
                })
            }
        }
    })
}

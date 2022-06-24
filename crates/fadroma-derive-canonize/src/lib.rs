use syn::{
    ItemStruct, Ident, Fields, LitInt, ItemImpl, Expr,
    FieldValue, parse_macro_input, parse_quote,
    punctuated::Punctuated,
    token::Comma
};
use proc_macro2::Span;
use quote::quote;

const CANONIZED_POSTFIX: &str = "Canon";

#[proc_macro_derive(Canonize)]
pub fn derive_canonize(stream: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let mut strukt = parse_macro_input!(stream as ItemStruct);
    
    let original_ident = strukt.ident;
    strukt.ident = Ident::new(&format!("{}{}", original_ident, CANONIZED_POSTFIX), Span::call_site());

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

fn generate_trait_impls(strukt: &ItemStruct, humanized: &Ident) -> proc_macro2::TokenStream {
    let canonized = &strukt.ident;
    let members = canonize_fields(strukt, true);

    let canonize_impl: ItemImpl = parse_quote! {
        impl fadroma::prelude::Canonize for #humanized {
            type Output = #canonized;

            fn canonize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#canonized #members)
            }
        }
    };

    let members = canonize_fields(strukt, false);

    let humanize_impl: ItemImpl = parse_quote! {
        impl fadroma::prelude::Humanize for #canonized {
            type Output = #humanized;

            fn humanize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(#humanized #members)
            }
        }
    };

    quote! {
        #canonize_impl
        #humanize_impl
    }
}

fn canonize_fields(strukt: &ItemStruct, canonize: bool) -> proc_macro2::TokenStream {
    match &strukt.fields {
        Fields::Named(fields) => {
            let mut members: Punctuated<FieldValue, Comma> = Punctuated::new();

            for field in fields.named.iter() {
                let name = field.ident.as_ref().unwrap(); // It's a named field.
                let value = if canonize {
                    parse_quote!(#name: fadroma::prelude::Canonize::canonize(self.#name, api)?)
                } else {
                    parse_quote!(#name: fadroma::prelude::Humanize::humanize(self.#name, api)?)
                };

                members.push(value);
            }

            quote!({ #members })
        },
        Fields::Unnamed(fields) => {
            let mut members: Punctuated<Expr, Comma> = Punctuated::new();

            for i in 0..fields.unnamed.len() {
                let lit = LitInt::new(&i.to_string(), Span::call_site());

                let value = if canonize {
                    parse_quote!(fadroma::prelude::Canonize::canonize(self.#lit, api)?)
                } else {
                    parse_quote!(fadroma::prelude::Humanize::humanize(self.#lit, api)?)
                };

                members.push(value);
            }

            quote!((#members))
        },
        Fields::Unit => unreachable!()
    }
}

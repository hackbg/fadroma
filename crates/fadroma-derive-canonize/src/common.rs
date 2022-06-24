use syn::{
    ItemStruct, Fields, LitInt,
    Expr, FieldValue, parse_quote,
    punctuated::Punctuated,
    token::Comma
};
use proc_macro2::Span;
use quote::quote;

pub fn canonize_fields(strukt: &ItemStruct, canonize: bool) -> proc_macro2::TokenStream {
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

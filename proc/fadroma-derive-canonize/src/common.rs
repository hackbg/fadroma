use proc_macro2::Span;
use quote::quote;
use syn::{
    parse_quote, punctuated::Punctuated, token::Comma, Attribute, Expr, FieldValue, Fields, LitInt,
};

pub const CANONIZED_POSTFIX: &str = "Canon";

pub fn canonize_fields(fields: &Fields, canonize: bool) -> proc_macro2::TokenStream {
    match &fields {
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
        }
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
        }
        Fields::Unit => proc_macro2::TokenStream::new(),
    }
}

pub fn add_serde_derive(attrs: &mut Vec<Attribute>) {
    attrs.clear();
    attrs.push(parse_quote!(#[derive(serde::Serialize)]));
    attrs.push(parse_quote!(#[derive(serde::Deserialize)]));
    attrs.push(parse_quote!(#[derive(fadroma::bin_serde::FadromaSerialize)]));
    attrs.push(parse_quote!(#[derive(fadroma::bin_serde::FadromaDeserialize)]));
}

pub fn transform_fields(fields: &mut Fields) -> syn::Result<()> {
    match fields {
        Fields::Named(fields) => {
            for mut field in fields.named.iter_mut() {
                let ty = &field.ty;
                field.ty = parse_quote!(<#ty as fadroma::prelude::Canonize>::Output);
            }
        }
        Fields::Unnamed(fields) => {
            for mut field in fields.unnamed.iter_mut() {
                let ty = &field.ty;
                field.ty = parse_quote!(<#ty as fadroma::prelude::Canonize>::Output);
            }
        }
        Fields::Unit => { }
    }

    Ok(())
}

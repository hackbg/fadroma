use proc_macro2::Span;
use quote::quote;
use syn::{
    parse_quote, punctuated::Punctuated, token::Comma, Expr, FieldValue, Fields, Ident, ItemEnum,
};

const CANONIZED_POSTFIX: &str = "Canon";

pub fn generate(mut input: ItemEnum) -> proc_macro::TokenStream {
    let original_ident = input.ident.clone();
    input.ident = Ident::new(
        &format!("{}{}", original_ident, CANONIZED_POSTFIX),
        Span::call_site(),
    );
    let canonized = &input.ident.clone();
    let canonized_impls = generate_trait_impls(&mut input, &original_ident, &canonized, true);
    let humanized_impls = generate_trait_impls(&mut input, &canonized, &original_ident, false);

    add_serde_derive(&mut input);

    proc_macro::TokenStream::from(quote! {
        #input
        impl fadroma::prelude::Canonize for #original_ident {
            type Output = #canonized;

            fn canonize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(match self {
                    #canonized_impls
                })
            }
        }
        impl fadroma::prelude::Humanize for #canonized {
            type Output = #original_ident;

            fn humanize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(match self {
                    #humanized_impls
                })
            }
        }
    })
}

fn add_serde_derive(strukt: &mut ItemEnum) {
    strukt.attrs.clear();
    strukt.attrs.push(parse_quote!(#[derive(serde::Serialize)]));
    strukt
        .attrs
        .push(parse_quote!(#[derive(serde::Deserialize)]));
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
        Fields::Unit => {
            return Err(syn::Error::new(
                Span::call_site(),
                "Unit variants are not supported.",
            ))
        }
    }

    Ok(())
}

fn generate_trait_impls(
    r#enum: &mut ItemEnum,
    ident: &Ident,
    orig: &Ident,
    canonize: bool,
) -> proc_macro2::TokenStream {
    let variants = &mut r#enum.variants;
    let mut res = Vec::new();
    // Transform each variant's fields
    for (_, variant) in variants.iter_mut().enumerate() {
        if canonize {
            transform_fields(&mut variant.fields).unwrap();
        }
        let name = &variant.ident;

        let names = extract_field_names(&variant.fields);

        let fields = canonize_fields(&variant.fields, canonize);

        res.push(quote! {
            #ident::#name #names => #orig::#name #fields,
        })
    }

    quote! {
        #(#res)*
    }
}

fn extract_field_names(fields: &Fields) -> proc_macro2::TokenStream {
    match &fields {
        Fields::Named(fields) => {
            let mut members: Punctuated<FieldValue, Comma> = Punctuated::new();
            for field in fields.named.iter() {
                let name = field.ident.as_ref().unwrap(); // It's a named field.
                let value = parse_quote!(#name);

                members.push(value);
            }

            quote!({ #members })
        }
        Fields::Unnamed(fields) => {
            let mut members: Punctuated<Expr, Comma> = Punctuated::new();
            for i in 0..fields.unnamed.len() {
                let nm = Ident::new(&format!("{}{}", "var", &i.to_string()), Span::call_site());
                let value = parse_quote!(#nm);

                members.push(value);
            }

            quote!((#members))
        }
        Fields::Unit => {
            unimplemented!()
        }
    }
}

pub fn canonize_fields(fields: &Fields, canonize: bool) -> proc_macro2::TokenStream {
    match &fields {
        Fields::Named(fields) => {
            let mut members: Punctuated<FieldValue, Comma> = Punctuated::new();

            for field in fields.named.iter() {
                let name = field.ident.as_ref().unwrap(); // It's a named field.
                let value = if canonize {
                    parse_quote!(#name: fadroma::prelude::Canonize::canonize(#name, api)?)
                } else {
                    parse_quote!(#name: fadroma::prelude::Humanize::humanize(#name, api)?)
                };

                members.push(value);
            }

            quote!({ #members })
        }
        Fields::Unnamed(fields) => {
            let mut members: Punctuated<Expr, Comma> = Punctuated::new();

            for i in 0..fields.unnamed.len() {
                let nm = Ident::new(&format!("{}{}", "var", &i.to_string()), Span::call_site());

                let value = if canonize {
                    parse_quote!(fadroma::prelude::Canonize::canonize(#nm, api)?)
                } else {
                    parse_quote!(fadroma::prelude::Humanize::humanize(#nm, api)?)
                };

                members.push(value);
            }

            quote!((#members))
        }
        Fields::Unit => unreachable!(),
    }
}

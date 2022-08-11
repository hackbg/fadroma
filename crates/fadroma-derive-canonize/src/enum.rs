use proc_macro2::Span;
use quote::quote;
use syn::{
    parse_quote, punctuated::Punctuated, token::Comma, Expr, FieldValue, Fields, Ident, ItemEnum,
    Variant,
};

const CANONIZED_POSTFIX: &str = "Canon";

pub fn generate(mut input: ItemEnum) -> proc_macro::TokenStream {
    // Original identifier.
    let humanized = input.ident;
    input.ident = Ident::new(
        &format!("{}{}", humanized, CANONIZED_POSTFIX),
        Span::call_site(),
    );

    // Identifier for new enum.
    let canonized = &input.ident.clone();
    add_serde_derive(&mut input);

    // Transform each variant's fields.
    let mut variants = &mut input.variants;
    for (_, variant) in variants.iter_mut().enumerate() {
        if let Err(err) = transform_fields(&mut variant.fields) {
            let err = err.into_compile_error();

            return proc_macro::TokenStream::from(quote!(#err));
        }
    }

    let canonized_impls = generate_match_arms(&mut variants, &humanized, &canonized, true);
    let humanized_impls = generate_match_arms(&mut variants, &canonized, &humanized, false);

    proc_macro::TokenStream::from(quote! {
        #input
        impl fadroma::prelude::Canonize for #humanized {
            type Output = #canonized;

            fn canonize(self, api: &impl cosmwasm_std::Api) -> cosmwasm_std::StdResult<Self::Output> {
                Ok(match self {
                    #canonized_impls
                })
            }
        }
        impl fadroma::prelude::Humanize for #canonized {
            type Output = #humanized;

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

fn transform_fields(fields: &mut Fields) -> syn::Result<()> {
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

fn generate_match_arms(
    variants: &mut Punctuated<Variant, Comma>,
    from: &Ident,
    to: &Ident,
    canonize: bool,
) -> proc_macro2::TokenStream {
    let mut res = Vec::new();
    for (_, variant) in variants.iter_mut().enumerate() {
        let name = &variant.ident;

        let names = extract_field_names(&variant.fields);

        let fields = canonize_fields(&variant.fields, canonize);

        res.push(quote! {
            #from::#name #names => #to::#name #fields,
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
                // Named field, unwrap is fine here.
                let name = field.ident.as_ref().unwrap();
                let value = parse_quote!(#name);

                members.push(value);
            }

            quote!({ #members })
        }
        Fields::Unnamed(fields) => {
            let mut members: Punctuated<Expr, Comma> = Punctuated::new();
            for i in 0..fields.unnamed.len() {
                let ident = Ident::new(&format!("{}{}", "var", &i.to_string()), Span::call_site());
                let value = parse_quote!(#ident);

                members.push(value);
            }

            quote!((#members))
        }
        Fields::Unit => {
            unreachable!()
        }
    }
}

fn canonize_fields(fields: &Fields, canonize: bool) -> proc_macro2::TokenStream {
    match &fields {
        Fields::Named(fields) => {
            let mut members: Punctuated<FieldValue, Comma> = Punctuated::new();

            for field in fields.named.iter() {
                // Named field, unwrap is fine here.
                let name = field.ident.as_ref().unwrap();
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
                let ident = Ident::new(&format!("{}{}", "var", &i.to_string()), Span::call_site());

                let value = if canonize {
                    parse_quote!(fadroma::prelude::Canonize::canonize(#ident, api)?)
                } else {
                    parse_quote!(fadroma::prelude::Humanize::humanize(#ident, api)?)
                };

                members.push(value);
            }

            quote!((#members))
        }
        Fields::Unit => unreachable!(),
    }
}

use std::iter::FromIterator;

use syn::{
    parse_macro_input, Item, ItemStruct, ItemEnum, Fields,
    Field, Member, Index, punctuated::Punctuated, Expr,
    FieldsNamed, FieldsUnnamed, FieldValue, ExprMatch,
    Arm, Pat, Ident, Visibility, Type, PatIdent, Stmt,
    FieldPat, token::{Comma, Add}, parse_quote
};
use quote::{quote, ToTokens};
use proc_macro2::Span;

#[cfg(test)]
mod tests;

#[derive(Clone, Copy)]
enum FieldsFor {
    Struct,
    Enum
}

#[proc_macro_derive(FadromaSerialize)]
pub fn derive_serialize(stream: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let item = parse_macro_input!(stream as Item);

    match &item {
        Item::Struct(s) => impl_struct_serialize(s),
        Item::Enum(e) => impl_enum_serialize(e),
        _ => {
            let err = syn::Error::new(
                Span::call_site(),
                "This macro can only be used on enum and struct definitions."
            ).to_compile_error();

            proc_macro::TokenStream::from(quote!(#err))
        }
    }
}

#[proc_macro_derive(FadromaDeserialize)]
pub fn derive_deserialize(stream: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let item = parse_macro_input!(stream as Item);

    match item {
        Item::Struct(s) => impl_struct_deserialize(&s),
        Item::Enum(e) => impl_enum_deserialize(&e),
        _ => {
            let err = syn::Error::new(
                Span::call_site(),
                "This macro can only be used on enum and struct definitions."
            ).to_compile_error();

            proc_macro::TokenStream::from(quote!(#err))
        }
    }
}

fn impl_struct_serialize(s: &ItemStruct) -> proc_macro::TokenStream {    
    let (size_hint, to_bytes) = match &s.fields {
        Fields::Named(f) => (
            size_hint_fields(&f.named, FieldsFor::Struct),
            to_bytes_fields(&f.named, FieldsFor::Struct)
        ),
        Fields::Unnamed(f) => (
            size_hint_fields(&f.unnamed, FieldsFor::Struct),
            to_bytes_fields(&f.unnamed, FieldsFor::Struct)
        ),
        Fields::Unit => (quote!(0), quote!(Ok(())))
    };

    let struct_ident = &s.ident;

    proc_macro::TokenStream::from(quote! {
        #[automatically_derived]
        impl fadroma::bin_serde::FadromaSerialize for #struct_ident {
            #[inline]
            fn size_hint(&self) -> usize {
                #size_hint
            }

            #[inline]
            fn to_bytes(&self, ser: &mut fadroma::bin_serde::Serializer) -> fadroma::bin_serde::Result<()> {
                #to_bytes
            }
        }
    })
}

fn impl_enum_serialize(e: &ItemEnum) -> proc_macro::TokenStream {
    let mut size_hint_arms = Punctuated::<Arm, Comma>::new();
    let mut to_bytes_arms = Punctuated::<Arm, Comma>::new();

    for (i, variant) in e.variants.iter().enumerate() {
        let tag = i as u8;
        let ident = &variant.ident;

        let (size_hint, to_bytes) = match &variant.fields {
            Fields::Named(f) => {
                let size_hint = size_hint_fields(&f.named, FieldsFor::Enum);
                let to_bytes = to_bytes_fields(&f.named, FieldsFor::Enum);

                let fields = Punctuated::<FieldPat, Comma>::from_iter(
                    f.named.clone().into_iter().map(|x| {
                        let ident = x.ident.unwrap();
                        FieldPat {
                            attrs: Vec::new(),
                            member: Member::Named(ident.clone()),
                            colon_token: None,
                            pat: Box::new(Pat::Ident(PatIdent {
                                attrs: Vec::new(),
                                by_ref: None,
                                mutability: None,
                                ident,
                                subpat: None
                            }))
                        }
                    })
                );

                (
                    parse_quote!(Self::#ident { #fields } => #size_hint),
                    parse_quote!(Self::#ident { #fields } => {
                        ser.write_byte(#tag);

                        #to_bytes
                    })
                )
            },
            Fields::Unnamed(f) => {
                let fields = f.unnamed.iter().enumerate().map(|(i, _)|  {
                    let ident = Ident::new(&format!("x{}", i), Span::call_site());

                    Field {
                        attrs: Vec::new(),
                        vis: Visibility::Inherited,
                        ident: Some(ident),
                        colon_token: None,
                        ty: Type::Verbatim(proc_macro2::TokenStream::new())
                    }
                });

                let fields = Punctuated::<Field, Comma>::from_iter(fields);
                let size_hint = size_hint_fields(&fields, FieldsFor::Enum);
                let to_bytes = to_bytes_fields(&fields, FieldsFor::Enum);

                let pat_idents = Punctuated::<Pat, Comma>::from_iter(
                    fields.clone().into_iter().map(|x|
                        Pat::Ident(PatIdent {
                            attrs: Vec::new(),
                            by_ref: None,
                            mutability: None,
                            ident: x.ident.unwrap(),
                            subpat: None
                        })
                    )
                );
                
                (
                    parse_quote!(Self::#ident(#pat_idents) => #size_hint),
                    parse_quote!(Self::#ident(#pat_idents) => {
                        ser.write_byte(#tag);

                        #to_bytes
                    })
                )
            },
            Fields::Unit => {
                (
                    parse_quote!(Self::#ident => 0),
                    parse_quote!(Self::#ident => {
                        ser.write_byte(#tag);
                        
                        Ok(())
                    })
                )
            }
        };

        size_hint_arms.push(size_hint);
        to_bytes_arms.push(to_bytes);
    }

    let struct_ident = &e.ident;
    let match_size_hint: ExprMatch = parse_quote!(match self { #size_hint_arms });
    let match_to_bytes: ExprMatch = parse_quote!(match self { #to_bytes_arms });

    proc_macro::TokenStream::from(quote! {
        #[automatically_derived]
        impl fadroma::bin_serde::FadromaSerialize for #struct_ident {
            #[inline]
            fn size_hint(&self) -> usize {
                1 + #match_size_hint
            }

            #[inline]
            fn to_bytes(&self, ser: &mut fadroma::bin_serde::Serializer) -> fadroma::bin_serde::Result<()> {
                #match_to_bytes
            }
        }
    })
}

fn impl_struct_deserialize(s: &ItemStruct) -> proc_macro::TokenStream {
    let from_bytes = match &s.fields {
        Fields::Named(f) => {
            let from_bytes = from_bytes_struct(f);

            quote!(Self { #from_bytes })
        },
        Fields::Unnamed(f) => {
            let from_bytes = from_bytes_tuple(f);

            quote!(Self(#from_bytes))
        },
        Fields::Unit => quote!(Self)
    };

    let struct_ident = &s.ident;

    proc_macro::TokenStream::from(quote! {
        #[automatically_derived]
        impl fadroma::bin_serde::FadromaDeserialize for #struct_ident {
            #[inline]
            fn from_bytes(de: &mut fadroma::bin_serde::Deserializer) -> fadroma::bin_serde::Result<Self> {
                Ok(#from_bytes)
            }
        }
    })
}

fn impl_enum_deserialize(e: &ItemEnum) -> proc_macro::TokenStream {
    let tag_var = Ident::new("tag".into(), Span::call_site());
    let mut arms = Punctuated::<Arm, Comma>::new();

    for (i, variant) in e.variants.iter().enumerate() {
        let tag = i as u8;
        let ident = &variant.ident;

        let arm = match &variant.fields {
            Fields::Named(f) => {
                let from_bytes = from_bytes_struct(f);

                parse_quote!(#tag => Ok(Self::#ident { #from_bytes }))
            },
            Fields::Unnamed(f) => {
                let from_bytes = from_bytes_tuple(f);

                parse_quote!(#tag => Ok(Self::#ident(#from_bytes)))
            },
            Fields::Unit => parse_quote!(#tag => Ok(Self::#ident))
        };

        arms.push(arm);
    }

    if e.variants.len() < u8::MAX as usize {
        let arm = parse_quote!(_ => Err(fadroma::bin_serde::Error::InvalidType));
        arms.push(arm);
    }

    let struct_ident = &e.ident;
    let tag_stmt: Stmt = parse_quote!(let #tag_var = de.read_byte()?;);
    let match_expr: ExprMatch = parse_quote!(match #tag_var { #arms });

    proc_macro::TokenStream::from(quote! {
        #[automatically_derived]
        impl fadroma::bin_serde::FadromaDeserialize for #struct_ident {
            #[inline]
            fn from_bytes(de: &mut fadroma::bin_serde::Deserializer) -> fadroma::bin_serde::Result<Self> {
                #tag_stmt
                #match_expr
            }
        }
    })
}

fn size_hint_fields(fields: &Punctuated<Field, Comma>, fields_for: FieldsFor) -> proc_macro2::TokenStream {
    if fields.len() > 0 {
        let mut result = Punctuated::<Expr, Add>::new();

        let receiver = match fields_for {
            FieldsFor::Struct => quote!(&self.),
            FieldsFor::Enum => proc_macro2::TokenStream::new(),
        };

        for (i, f) in fields.iter().enumerate() {
            let member = match f.ident.clone() {
                Some(ident) => Member::Named(ident),
                None => Member::Unnamed(Index { index: i as u32, span: Span::call_site() })
            };

            let expr = parse_quote!(fadroma::bin_serde::FadromaSerialize::size_hint(#receiver #member));
            result.push(expr);
        }

        result.to_token_stream()
    } else {
        quote!(0)
    }
}

fn to_bytes_fields(fields: &Punctuated<Field, Comma>, fields_for: FieldsFor) -> proc_macro2::TokenStream {
    let mut result = proc_macro2::TokenStream::new();

    let receiver = match fields_for {
        FieldsFor::Struct => quote!(&self.),
        FieldsFor::Enum => proc_macro2::TokenStream::new(),
    };

    for (i, f) in fields.iter().enumerate() {
        let member = match f.ident.clone() {
            Some(ident) => Member::Named(ident),
            None => Member::Unnamed(Index { index: i as u32, span: Span::call_site() })
        };

        let stmt = quote!(fadroma::bin_serde::FadromaSerialize::to_bytes(#receiver #member, ser)?;);
        result.extend(stmt);
    }

    quote! {
        #result
        
        Ok(())
    }
}

fn from_bytes_struct(fields: &FieldsNamed) -> Punctuated::<FieldValue, Comma> {
    let mut result = Punctuated::<FieldValue, Comma>::new();

    for f in &fields.named {
        let field_expr: FieldValue = match &f.ident {
            Some(ident) => parse_quote!(#ident: de.deserialize()?),
            None => unreachable!()
        };

        result.push(field_expr);
    }

    result
}

fn from_bytes_tuple(fields: &FieldsUnnamed) -> Punctuated::<Expr, Comma> {
    let mut result = Punctuated::<Expr, Comma>::new();

    for f in &fields.unnamed {
        let field_expr: Expr = match f.ident.clone() {
            Some(_) => unreachable!(),
            None => parse_quote!(de.deserialize()?)
        };

        result.push(field_expr);
    }

    result
}

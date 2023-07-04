use syn::{
    ItemTrait, TraitItem, PathArguments, TypeParamBound,
    TraitBoundModifier, punctuated::Punctuated, token::Add,
};
use quote::{ToTokens, quote};

use crate::{
    attr::{MsgAttr, ERROR_TYPE},
    err::{ErrorSink, CompileErrors},
    generate::{self, MsgType},
    method::{Method, trait_methods},
    validate
};

pub const SUPPORTED_ATTRS: [&'static str; 3] = [
    MsgAttr::EXECUTE,
    MsgAttr::QUERY,
    MsgAttr::INIT
];

pub fn derive(r#trait: ItemTrait) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let mut sink = ErrorSink::default();
    let interface = Interface::parse(&mut sink, &r#trait);

    let init_msg = interface.init.and_then(|x|
        Some(generate::init_msg(&mut sink, &x)
            .to_token_stream()
        ))
        .unwrap_or(proc_macro2::TokenStream::new());

    let execute_msg = generate::messages(
        &mut sink,
        MsgType::Execute,
        &interface.execute
    );
    let query_msg = generate::messages(
        &mut sink,
        MsgType::Query,
        &interface.query
    );

    sink.check()?;

    Ok(quote! {
        #init_msg
        #execute_msg
        #query_msg
    })
}

#[inline]
pub fn is_valid_attr(attr: MsgAttr) -> bool {
    SUPPORTED_ATTRS.contains(&attr.as_str())
}

struct Interface<'a> {
    /// Optional because an interface might not want to have an init method.
    init: Option<Method<'a>>,
    execute: Vec<Method<'a>>,
    query: Vec<Method<'a>>
}

impl<'a> Interface<'a> {
    fn parse(sink: &mut ErrorSink, r#trait: &'a ItemTrait) -> Self {
        let trait_ident = &r#trait.ident;
        let mut init: Option<Method> = None;
        let mut execute: Vec<Method> = vec![];
        let mut query: Vec<Method> = vec![];

        // We forbid generic traits because they will complicate the error type on contracts.
        if validate::has_generics(&r#trait.generics) {
            sink.push_spanned(
                &r#trait,
                "Interface traits cannot have any generics."
            );
        }

        let err_ty = r#trait.items.iter().find_map(|x| {
            match x {
                TraitItem::Type(type_def)
                    if type_def.ident.to_string() == ERROR_TYPE => 
                {
                    Some(type_def)
                }
                _ => None
            }
        });

        if let Some(err_ty) = err_ty {
            if !validate_err_bound(&err_ty.bounds) {
                sink.push_spanned(
                    &err_ty,
                    format!("{} type must have a single \"std::fmt::Display\" bound.", ERROR_TYPE)
                );
            }

            if validate::has_generics(&err_ty.generics) {
                sink.push_spanned(
                    &err_ty.generics,
                    format!("{} type cannot have any generics.", ERROR_TYPE)
                );
            }
        } else {
            sink.push_spanned(
                trait_ident,
                format!("Missing \"type {}: std::fmt::Display;\" trait type declaration.", ERROR_TYPE)
            );
        }

        for method in trait_methods(sink, r#trait) {
            let ty = method.ty;
            match ty {
                MsgAttr::Init { .. } if init.is_some() =>
                    sink.duplicate_annotation(trait_ident, ty),
                MsgAttr::Init { entry } => {
                    if entry.is_some() {
                        sink.push_spanned(&method.sig, "Interfaces cannot have entry points.");
                    }

                    init = Some(Method::Interface(method));
                }
                MsgAttr::Execute => execute.push(Method::Interface(method)),
                MsgAttr::Query => query.push(Method::Interface(method)),
                unsupported => sink.unsupported_interface_attr(
                    &method.sig.ident,
                    unsupported
                )
            }
        }

        Self {
            init,
            execute,
            query
        }
    }
}

fn validate_err_bound(bounds: &Punctuated<TypeParamBound, Add>) -> bool {
    if bounds.len() != 1 {
        return false;
    }

    let TypeParamBound::Trait(bound) = bounds.first().unwrap() else {
        return false;
    };

    if !matches!(bound.modifier, TraitBoundModifier::None) ||
        bound.lifetimes.is_some()
    {
        return false;
    }

    let Some(segment) = bound.path.segments.last() else {
        return false;
    };

    segment.ident.to_string() == "Display" &&
        segment.arguments == PathArguments::None
}

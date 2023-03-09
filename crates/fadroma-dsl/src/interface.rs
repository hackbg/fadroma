use syn::{
    ItemTrait, TraitItem, TraitItemMethod, PathArguments, GenericArgument,
    TypeParamBound, TraitBoundModifier, punctuated::Punctuated, token::Add,
    parse_quote
};
use quote::{ToTokens, quote};

use crate::{
    attr::{MsgAttr, ERROR_TYPE},
    err::{ErrorSink, CompileErrors},
    generate::{self, MsgType},
    validate
};

pub fn derive(r#trait: ItemTrait) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let mut sink = ErrorSink::default();
    let interface = Interface::parse(&mut sink, r#trait);

    let init_msg = interface.init.and_then(|x|
        Some(generate::init_msg(&mut sink, &x.sig)
            .to_token_stream()
        ))
        .unwrap_or(proc_macro2::TokenStream::new());

    let execute_msg = generate::messages(
        &mut sink,
        MsgType::Execute,
        interface.execute.iter().map(|x| &x.sig)
    );
    let query_msg = generate::messages(
        &mut sink,
        MsgType::Query,
        interface.query.iter().map(|x| &x.sig)
    );

    sink.check()?;

    Ok(quote! {
        #init_msg
        #execute_msg
        #query_msg
    })
}

struct Interface {
    /// Optional because an interface might not want to have an init method.
    init: Option<TraitItemMethod>,
    execute: Vec<TraitItemMethod>,
    query: Vec<TraitItemMethod>
}

impl Interface {
    fn parse(sink: &mut ErrorSink, r#trait: ItemTrait) -> Self {
        let mut has_error_ty = false;

        let trait_ident = &r#trait.ident;
        let mut init = None;
        let mut execute = vec![];
        let mut query = vec![];

        // We forbid generic traits because they will complicate the error type on contracts.
        if !r#trait.generics.params.is_empty() ||
            r#trait.generics.where_clause.is_some() {
            sink.push_spanned(
                &r#trait,
                "Interface traits cannot have any generics."
            );
        }

        for item in r#trait.items {
            match item {
                TraitItem::Method(method) => {
                    match MsgAttr::parse(sink, &method.attrs) {
                        Some(attr) => match attr {
                            MsgAttr::Init { .. } if init.is_some() => sink.push_spanned(
                                trait_ident,
                                "Only one method can be annotated as #[init].",
                            ),
                            MsgAttr::Init { entry } => {
                                if entry {
                                    sink.push_spanned(&method.attrs[0], "Interfaces cannot have entry points.");
                                }

                                validate_method(sink, &method, Some(parse_quote!(Response)));
                                init = Some(method);
                            }
                            MsgAttr::Execute => {
                                validate_method(sink, &method, Some(parse_quote!(Response)));
                                execute.push(method);
                            }
                            MsgAttr::Query => {
                                validate_method(sink, &method, None);
                                query.push(method);
                            }
                        }
                        None => sink.push_spanned(
                            &method.sig.ident,
                            format!("Expecting exactly one attribute of: {:?}", MsgAttr::ALL)
                        )
                    }
                }
                TraitItem::Type(type_def)
                    if type_def.ident.to_string() == ERROR_TYPE => 
                {
                    has_error_ty = true;

                    if !validate_err_bound(&type_def.bounds) {
                        sink.push_spanned(
                            &type_def,
                            format!("{} type must have a single \"std::string::ToString\" bound.", ERROR_TYPE)
                        );
                    }

                    if !type_def.generics.params.is_empty() ||
                        type_def.generics.where_clause.is_some() {
                        sink.push_spanned(
                            type_def.generics,
                            format!("{} type cannot have any generics.", ERROR_TYPE)
                        );
                    }
                }
                _ => { }
            }
        }

        if !has_error_ty {
            sink.push_spanned(
                trait_ident,
                format!("Missing \"type {}: ToString;\" trait type declaration.", ERROR_TYPE)
            );
        }

        Self {
            init,
            execute,
            query
        }
    }
}

fn validate_method(
    sink: &mut ErrorSink,
    method: &TraitItemMethod,
    expected: Option<GenericArgument>
) {
    if method.default.is_some() {
        sink.push_spanned(
            method,
            "Contract interface method cannot contain a default implementation."
        );
    }

    let err_arg: GenericArgument = parse_quote!(Self::Error);
    validate::result_type(sink, &method.sig, (expected, Some(err_arg)));
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

    segment.ident.to_string() == "ToString" &&
        segment.arguments == PathArguments::None
}
